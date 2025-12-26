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

  // XML 路径控制（可选）
  includeXmlPaths?: string[]   // 包含的 XML 路径模式
  excludeXmlPaths?: string[]   // 排除的 XML 路径模式
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

    // 等待LanguageClient完全准备好
    await this.client.onReady()

    // 等待服务器完全准备好后再加载文件
    await this.initLoading()

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
          includeVanillaData: true,

          // 默认只加载当前版本的 Defs
          includeXmlPaths: ['Defs/**/*.xml', '1.6/Defs/**/*.xml'],
          excludeXmlPaths: []
        }
        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 4), 'utf-8')
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
   * 根据配置获取 XML 文件路径
   */
  private async getConfiguredXmlUris(): Promise<Uri[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) return []

    const uris: Uri[] = []
    for (const folder of workspaceFolders) {
      const configPath = path.join(folder.uri.fsPath, 'rwxml-config.json')
      if (!fs.existsSync(configPath)) {
        // 没有配置文件，加载所有 XML（向后兼容）
        const allXmls = await vscode.workspace.findFiles('**/*.xml')
        uris.push(...allXmls)
        continue
      }

      try {
        const config: ProjectConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        const includePatterns = config.includeXmlPaths
        const excludePatterns = config.excludeXmlPaths || []

        // 如果没有配置 includeXmlPaths，加载所有 XML（向后兼容）
        if (!includePatterns || includePatterns.length === 0) {
          const allXmls = await vscode.workspace.findFiles('**/*.xml')
          uris.push(...allXmls)
          continue
        }

        // 构建模式列表（使用 fast-glob 的 ! 排除语法）
        const allPatterns: string[] = [...includePatterns]
        for (const excludePattern of excludePatterns) {
          allPatterns.push(`!${excludePattern}`)
        }

        // 收集匹配的文件
        for (const pattern of allPatterns) {
          const absolutePattern = path.join(folder.uri.fsPath, pattern).replace(/\\/g, '/')
          try {
            const matches = await glob.default(absolutePattern)
            uris.push(...matches.map(m => Uri.file(m)))
          } catch (e) {
            this.log.warn(`Failed to glob pattern "${pattern}": ${e}`)
          }
        }

      } catch (e) {
        this.log.error(`Failed to parse config at ${configPath}: ${e}`)
        // 出错时回退到加载所有 XML
        const allXmls = await vscode.workspace.findFiles('**/*.xml')
        uris.push(...allXmls)
      }
    }

    // 去重
    const uniqueUris = Array.from(new Map(uris.map(uri => [uri.toString(), uri])).values())
    return uniqueUris
  }

  /**
   * scan all files on current workspace for initial loading
   */
  private async initLoading(): Promise<void> {
    // 1. 根据配置扫描 XML 文件
    const xmlUris = await this.getConfiguredXmlUris()

    // 2. 扫描其他资源文件（音频、图片）
    const assetUris = await vscode.workspace.findFiles('**/*.{wav,mp3,bmp,jpeg,jpg,png}')

    // 3. 根据配置扫描 DLL 文件
    const dllUris = await this.getConfiguredDllUris()

    const uris = [...xmlUris, ...assetUris, ...dllUris]
    this.log.info(`sending initial load files. count: ${uris.length} (XML: ${xmlUris.length}, Assets: ${assetUris.length}, DLLs: ${dllUris.length})`)

    // 分批发送，每批50个文件，每批之间延迟100ms
    const batchSize = 50
    let successCount = 0
    let errorCount = 0

    for (let i = 0; i < uris.length; i += batchSize) {
      const batch = uris.slice(i, Math.min(i + batchSize, uris.length))
      this.log.info(`sending batch ${Math.floor(i / batchSize) + 1}, size: ${batch.length}`)

      for (const uri of batch) {
        try {
          this.client.sendNotification(ProjectFileAdded, { uri: uri.toString() })
          successCount++
        } catch (e) {
          this.log.error(`Failed to send initial file ${uri}: ${e}`)
          errorCount++
        }
      }
      // 批次之间延迟，避免缓冲区溢出
      if (i + batchSize < uris.length) {
        await new Promise(resolve => setTimeout(resolve, 100))
      }
    }
    this.log.info(`finished sending initial load files. success: ${successCount}, errors: ${errorCount}`)
  }

  /**
   * 检查文件是否应该被处理（根据配置过滤）
   */
  private async shouldProcessFile(uri: Uri): Promise<boolean> {
    const ext = path.extname(uri.fsPath).toLowerCase()

    // 非 XML 文件总是处理（音频、图片、DLL）
    if (ext !== '.xml') {
      return true
    }

    // XML 文件需要检查配置
    const workspaceFolders = vscode.workspace.workspaceFolders
    if (!workspaceFolders) return true

    for (const folder of workspaceFolders) {
      // 只检查属于当前工作区的文件
      if (!uri.fsPath.startsWith(folder.uri.fsPath)) continue

      const configPath = path.join(folder.uri.fsPath, 'rwxml-config.json')
      if (!fs.existsSync(configPath)) {
        // 没有配置文件，处理所有 XML
        return true
      }

      try {
        const config: ProjectConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        const includePatterns = config.includeXmlPaths
        const excludePatterns = config.excludeXmlPaths || []

        // 没有配置 includeXmlPaths，处理所有 XML
        if (!includePatterns || includePatterns.length === 0) {
          return true
        }

        // 获取相对路径
        const relativePath = path.relative(folder.uri.fsPath, uri.fsPath).replace(/\\/g, '/')

        // 检查是否在排除列表中
        for (const excludePattern of excludePatterns) {
          const matches = await glob.default(excludePattern, { cwd: folder.uri.fsPath })
          if (matches.includes(relativePath)) {
            return false
          }
        }

        // 检查是否在包含列表中
        for (const includePattern of includePatterns) {
          const matches = await glob.default(includePattern, { cwd: folder.uri.fsPath })
          if (matches.includes(relativePath)) {
            return true
          }
        }

        // 不在任何模式中，不处理
        return false

      } catch (e) {
        this.log.error(`Failed to check file filtering: ${e}`)
        return true // 出错时默认处理
      }
    }

    return true
  }

  private async onDidcreate(uri: Uri): Promise<void> {
    // 如果是配置文件变动，重新初始化加载
    if (uri.fsPath.endsWith('rwxml-config.json')) {
      this.initLoading()
      return
    }

    // 检查是否应该处理此文件
    const shouldProcess = await this.shouldProcessFile(uri)
    if (!shouldProcess) {
      this.log.silly(`Skipping file (filtered by config): ${uri.fsPath}`)
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

    // 检查是否应该处理此文件
    const shouldProcess = await this.shouldProcessFile(uri)
    if (!shouldProcess) {
      this.log.silly(`Skipping file change (filtered by config): ${uri.fsPath}`)
      return
    }

    try {
      this.client.sendNotification(ProjectFileChanged, { uri: uri.toString() })
    } catch (e) {}
  }

  private async onDidDelete(uri: Uri): Promise<void> {
    // XML 文件也需要检查（删除时）
    const ext = path.extname(uri.fsPath).toLowerCase()
    if (ext === '.xml') {
      const shouldProcess = await this.shouldProcessFile(uri)
      if (!shouldProcess) {
        this.log.silly(`Skipping file deletion (filtered by config): ${uri.fsPath}`)
        return
      }
    }

    try {
      this.client.sendNotification(ProjectFileDeleted, { uri: uri.toString() })
    } catch (e) {}
  }
}