import { injectable } from 'tsyringe'
import vscode, { Uri, workspace } from 'vscode'
import { LanguageClient, State } from 'vscode-languageclient'
import * as winston from 'winston'
import { ProjectFileAdded, ProjectFileChanged, ProjectFileDeleted } from './events'
import { className, log, logFormat } from './log'
import jsonStr from './utils/json'
import * as fs from 'fs'
import * as path from 'path'
import * as glob from 'fast-glob'

const watchedExts = ['xml', 'wav', 'mp3', 'bmp', 'jpeg', 'jpg', 'png', 'dll']
export const globPattern = `**/*.{${watchedExts.join(',')}}`

interface ProjectConfig {
  dllPaths: string[]
  includeVanillaData: boolean
}

@injectable()
export class ProjectWatcher {
  private log = winston.createLogger({
    format: winston.format.combine(className(ProjectWatcher), logFormat),
    transports: [log],
  })

  private readonly fileSystemWatcher = workspace.createFileSystemWatcher(globPattern)

  private watching = false

  get isWatching(): boolean {
    return this.watching
  }

  constructor(private readonly client: LanguageClient) {}

  async start(): Promise<void> {
    if (this.isWatching) {
      return
    }

    this.log.info('Waiting for language client to be ready...')
    
    // 初始化配置
    await this.ensureConfigExists()

    this.fileSystemWatcher.onDidCreate(this.onDidcreate.bind(this))
    this.fileSystemWatcher.onDidChange(this.onDidChange.bind(this))
    this.fileSystemWatcher.onDidDelete(this.onDidDelete.bind(this))

    this.initLoading()

    this.watching = true
  }

  private async ensureConfigExists(): Promise<void> {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) return

    for (const folder of workspaceFolders) {
      const configPath = path.join(folder.uri.fsPath, 'rwxml-config.json')
      if (!fs.existsSync(configPath)) {
        const defaultConfig: ProjectConfig = {
          dllPaths: [
            'Assemblies/*.dll',
            '1.6/Assemblies/*.dll'
          ],
          includeVanillaData: true
        }
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8')
        this.log.info(`Created default config at ${configPath}`)
      }
    }
  }

  private async getConfiguredDllUris(): Promise<Uri[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) return []

    const uris: Uri[] = []
    for (const folder of workspaceFolders) {
      const configPath = path.join(folder.uri.fsPath, 'rwxml-config.json')
      if (fs.existsSync(configPath)) {
        try {
          const config: ProjectConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
          for (const pattern of config.dllPaths) {
            const absolutePattern = path.join(folder.uri.fsPath, pattern).replace(/\\/g, '/')
            const matches = await glob.default(absolutePattern)
            uris.push(...matches.map(m => Uri.file(m)))
          }
        } catch (e) {
          this.log.error(`Failed to parse config at ${configPath}: ${e}`)
        }
      }
    }
    return uris
  }

  /**
   * scan all files on current workspace for initial loading
   */
  private async initLoading(): Promise<void> {
    // 1. 扫描 XML 和资源文件
    const assetUris = await vscode.workspace.findFiles('**/*.{xml,wav,mp3,bmp,jpeg,jpg,png}')
    
    // 2. 根据配置扫描 DLL 文件
    const dllUris = await this.getConfiguredDllUris()
    
    const uris = [...assetUris, ...dllUris]
    this.log.debug(`sending initial load files. count: ${uris.length} (Assets: ${assetUris.length}, DLLs: ${dllUris.length})`)
    
    for (const uri of uris) {
      try {
        this.client.sendNotification(ProjectFileAdded, { uri: uri.toString() })
      } catch (e) {
        this.log.error(`Failed to send initial file ${uri}: ${e}`)
      }
    }
  }

  private async onDidcreate(uri: Uri): Promise<void> {
    // 如果是配置文件变动，重新初始化加载
    if (uri.fsPath.endsWith('rwxml-config.json')) {
      this.initLoading()
      return
    }

    try {
      this.client.sendNotification(ProjectFileAdded, { uri: uri.toString() })
    } catch (e) {}
  }

  private async onDidChange(uri: Uri): Promise<void> {
    if (uri.fsPath.endsWith('rwxml-config.json')) {
      this.initLoading()
      return
    }

    try {
      this.client.sendNotification(ProjectFileChanged, { uri: uri.toString() })
    } catch (e) {}
  }

  private async onDidDelete(uri: Uri): Promise<void> {
    try {
      this.client.sendNotification(ProjectFileDeleted, { uri: uri.toString() })
    } catch (e) {}
  }
}