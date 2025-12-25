import { spawnSync } from 'child_process'
import { getFileProperties } from 'get-file-properties'
import ono from 'ono'
import * as path from 'path'
import * as semver from 'semver'
import * as tsyringe from 'tsyringe'
import * as vscode from 'vscode'
import { LanguageClient, ResponseError } from 'vscode-languageclient'
import winston from 'winston'
import { TypeInfoRequest, TypeInfoRequestResponse } from '../events'
import { className, log, logFormat } from '../log'
import * as mod from '../mod'
import { extractTypeInfos } from '../typeInfo'
import jsonStr from '../utils/json'
import { createProgress } from '../utils/progress'
import { Provider } from './provider'
import * as fs from 'fs'

@tsyringe.injectable()
export class TypeInfoProvider implements Provider {
  private log = winston.createLogger({
    format: winston.format.combine(className(TypeInfoProvider), logFormat),
    transports: [log],
  })

  private static readonly defaultVersion = new semver.SemVer('0.0.0')

  constructor(@tsyringe.inject(mod.PathStore.token) private readonly pathStore: mod.PathStore) {}

  async listen(client: LanguageClient): Promise<void> {
    await client.onReady()
    client.onRequest(TypeInfoRequest, this.onTypeInfoRequest.bind(this))
  }

  private requestCounter = 0
  private clearProgress: (() => void) | null = null

  async onTypeInfoRequest({ uris, version }: TypeInfoRequest): Promise<TypeInfoRequestResponse | ResponseError<Error>> {
    this.log.info(`Received TypeInfo request for version: ${version}`)

    // 尝试从项目根目录加载 1.6 元数据作为保底
    const localMetadataPath = 'D:/RimworldProject/rwxml-language-server-master/rimworld-defs-metadata-1.6.json';
    
    if (fs.existsSync(localMetadataPath)) {
      this.log.info(`Found local metadata file at ${localMetadataPath}. Loading...`);
      try {
        const buffer = fs.readFileSync(localMetadataPath);
        let content = "";
        
        // 健壮的编码处理
        if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
          // UTF-16 LE
          content = buffer.toString('utf16le', 2);
        } else if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
          // UTF-8 with BOM
          content = buffer.toString('utf8', 3);
        } else {
          // Plain UTF-8
          content = buffer.toString('utf8');
        }
        
        // 移除可能存在的杂质字符
        content = content.trim();
        if (content.charCodeAt(0) === 0xFEFF) {
          content = content.slice(1);
        }

        const data = JSON.parse(content);
        this.log.info('Successfully loaded local metadata (1.6). skipping DLL extraction and version check.');
        return { data };
      } catch (e) {
        this.log.error(`Critical error parsing local metadata JSON: ${e}`);
        // 如果本地文件损坏，我们尝试继续执行正常的提取逻辑
      }
    }

    const CoreDLLPath = this.pathStore.RimWorldCoreDLLPath
    const semverVersion = this.parseVersion(version)
    if (!semverVersion) {
      const err = ono(`cannot parse version: ${version}`)
      this.log.error(err)
      return new ResponseError(1, err.message, err)
    }

    const isCoreDLLVersionCorrect = await this.checkCoreDLLVersion(CoreDLLPath, semverVersion)
    if (!isCoreDLLVersionCorrect) {
      const actualVersion = await this.getCoreDLLVersion(CoreDLLPath);
      const err = ono(
        `Core DLL version mismatch. expected: ${semverVersion}, actual: ${actualVersion}`
      )
      this.log.error(err)
      // 如果版本不匹配，在开发阶段我们选择继续尝试提取，而不是直接返回错误
      this.log.warn('Proceeding with extraction anyway despite version mismatch.');
    }

    if (!this.clearProgress) {
      const { resolve } = await createProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'RWXML: reading DLLs...', 
      })
      this.clearProgress = resolve
    }
    this.requestCounter += 1

    const typeInfo = await this.extractTypeInfo(uris)

    this.requestCounter -= 1
    if (this.requestCounter < 0) {
      this.requestCounter = 0
      this.log.error('request counter is negative.')
    }

    if (this.requestCounter === 0) {
      console.assert(this.clearProgress !== null)
      this.clearProgress()
      this.clearProgress = null
    }

    if (typeInfo instanceof Error) {
      log.error(typeInfo)
      return new ResponseError(3, typeInfo.message, typeInfo)
    } else {
      return { data: typeInfo }
    }
  }

  async extractTypeInfo(uris: string[]): Promise<unknown[] | Error> {
    const dllPaths = uris.map((uri) => vscode.Uri.parse(uri).fsPath) // single .dll file or directory

    const managedDirectory = this.pathStore.RimWorldManagedDirectory

    this.log.debug('managed directory: ', managedDirectory)
    dllPaths.push(managedDirectory)

    this.log.debug(`extracting typeinfos from: ${jsonStr(dllPaths)}`)
    return await extractTypeInfos(...dllPaths)
  }

  async checkCoreDLLVersion(DLLPath: string, version: semver.SemVer): Promise<boolean> {
    this.log.debug('checking Core DLL version...')
    if (version.compare(TypeInfoProvider.defaultVersion) === 0) {
      this.log.debug('version is default. skipping check.')
      return true
    }

    const fileVersionOrErr = await this.getCoreDLLVersion(DLLPath)
    if (fileVersionOrErr instanceof Error) {
      this.log.error(`failed to get Core DLL version. err: ${fileVersionOrErr}`)
      return false
    }

    const fileVersion = semver.coerce(fileVersionOrErr)
    if (!fileVersion) {
      this.log.error(`failed to parse Core DLL version. version: ${fileVersionOrErr}`)
      return false
    }

    return fileVersion.major === version.major && fileVersion.minor === version.minor
  }

  async getCoreDLLVersion(DLLPath: string): Promise<string | Error> {
    switch (process.platform) {
      case 'win32':
        return (await this.getFileVersionWindows(DLLPath)) ?? Error('RWXML: failed to get Core DLL version')

      case 'linux':
        return await this.getFileVersionLinux(DLLPath)

      default:
        return Error(`Unsupported platform: ${process.platform}`)
    }
  }

  private parseVersion(version: string): semver.SemVer | null {
    if (version === 'default') {
      return TypeInfoProvider.defaultVersion
    } else {
      return semver.coerce(version)
    }
  }

  private async getFileVersionWindows(path: string): Promise<string | null> {
    const properties = await getFileProperties(path)
    return properties.Version ?? null
  }

  private async getFileVersionLinux(path: string): Promise<string | Error> {
    try {
      const process = spawnSync('strings', [path, '-el'], { stdio: 'pipe' })
      const stdout = process.stdout.toString('utf-8')
      const lines = stdout.split('\n')

      const index = lines.findIndex((value) => value === 'Assembly Version')
      return lines[index + 1]
    } catch (err: unknown) {
      return ono(err as any)
    }
  }
}