import { TypeInfo } from './typeInfo'
import { DefType, TypeIdentifier } from './declaredType'
import { isFullName } from './util'
import { cache, CacheScope, CacheType } from 'cache-decorator'

const rimworldNamespaces = [
  'Verse',
  'RimWorld',
  'Verse.AI',
  'Verse.AI.Group',
  'Verse.Noise',
  'Verse.Sound',
  'RimWorld.Planet',
  'Verse.Profile',
  'Verse.Grammar',
  'RimWorld.BaseGen',
  'RimWorld.IO',
  'RimWorld.QuestGen',
  'RimWorld.SketchGen',
]

export class TypeInfoMap {
  private typeMap: Map<TypeIdentifier, TypeInfo> = new Map()
  private classNameMap: Map<string, TypeInfo[]> = new Map()

  /** raw data used for building typeInfoMap. read-only */
  rawData: any = undefined

  addTypeInfo(typeInfo: TypeInfo): void {
    this.checkTypeAlreadyExists(typeInfo)
    this.typeMap.set(typeInfo.fullName, typeInfo)

    // index by className for fast lookup
    const lowerName = typeInfo.className.toLowerCase()
    let list = this.classNameMap.get(lowerName)
    if (!list) {
      list = []
      this.classNameMap.set(lowerName, list)
    }
    list.push(typeInfo)
  }

  addTypeInfos(...typeInfos: TypeInfo[]): void {
    for (const typeInfo of typeInfos) {
      this.addTypeInfo(typeInfo)
    }
  }

  getAllNodes(): TypeInfo[] {
    return [...this.typeMap.values()]
  }

  @cache({ type: CacheType.MEMO, scope: CacheScope.INSTANCE })
  getAllCompTypes(): TypeInfo[] {
    return this.getAllNodes().filter((type) => type.className.startsWith('Comp'))
  }

  @cache({ type: CacheType.MEMO, scope: CacheScope.INSTANCE })
  getAllVerbTypes(): TypeInfo[] {
    return this.getAllNodes().filter((type) => type.className.startsWith('Verb_'))
  }

  getTypeInfoByName(name: string): TypeInfo | null {
    // 1. exact match (fullName)
    const exactMatch = this.typeMap.get(name)
    if (exactMatch) {
      return exactMatch
    }

    // 2. lookup by className (case-insensitive)
    const list = this.classNameMap.get(name.toLowerCase())
    if (list && list.length > 0) {
      // return the one that is most likely intended (e.g. shortest fullName or just the first one)
      return list[0]
    }

    return null
  }

  getTypeInfoFullName(id: TypeIdentifier): TypeInfo | undefined {
    return this.typeMap.get(id)
  }

  private checkTypeAlreadyExists(typeInfo: TypeInfo) {
    if (this.typeMap.has(typeInfo.fullName)) {
      throw new Error(`exception while adding typeInfo: type ${typeInfo.fullName} is already exists`)
    }
  }
}
