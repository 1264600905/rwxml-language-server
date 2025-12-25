"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const typeInfoLoader_1 = require("./src/rimworld-types/typeInfoLoader");
const typeInfoInjector_1 = require("./src/rimworld-types/typeInfoInjector");
const parser_1 = require("./src/parser");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const fast_glob_1 = __importDefault(require("fast-glob"));
const perf_hooks_1 = require("perf_hooks");
// 配置路径
const METADATA_PATH = path.resolve(__dirname, '../rimworld-defs-metadata-1.6.json');
// 注意：这里硬编码了你的路径，运行时请确保该路径存在
const TARGET_DIR = 'H:/SteamLibrary/steamapps/common/RimWorld/Data/Anomaly';
async function main() {
    console.log(`[1/4] Loading metadata from ${METADATA_PATH}...`);
    if (!fs.existsSync(METADATA_PATH)) {
        console.error('Error: Metadata file not found!');
        process.exit(1);
    }
    // 1. 加载元数据
    const rawMetadata = JSON.parse(fs.readFileSync(METADATA_PATH, 'utf-8'));
    // 注意：TypeInfoLoader.load 返回的是 TypeInfoMap
    const typeInfoMap = typeInfoLoader_1.TypeInfoLoader.load(rawMetadata);
    console.log(`Metadata loaded successfully.`);
    // 2. 扫描 XML 文件
    console.log(`[2/4] Scanning XML files in ${TARGET_DIR}...`);
    // 修正正则：\\ -> /
    const xmlPattern = `${TARGET_DIR.replace(/\\/g, '/')}/**/*.xml`;
    const xmlFiles = await (0, fast_glob_1.default)(xmlPattern, { dot: true });
    if (xmlFiles.length === 0) {
        console.error('Error: No XML files found. Check the path or permissions.');
        try {
            console.log('Directory contents:', fs.readdirSync(TARGET_DIR));
        }
        catch (e) {
            console.log('Cannot list directory:', e.message);
        }
        process.exit(1);
    }
    console.log(`Found ${xmlFiles.length} XML files.`);
    // 3. 解析与校验
    console.log(`[3/4] Parsing and analyzing files...`);
    const injector = new typeInfoInjector_1.TypeInfoInjector(typeInfoMap);
    let totalTime = 0;
    let successCount = 0;
    let errorCount = 0;
    for (const file of xmlFiles) {
        try {
            const content = fs.readFileSync(file, 'utf-8');
            const start = perf_hooks_1.performance.now();
            // 解析 XML
            const root = (0, parser_1.parse)(content, file);
            // 注入元数据
            injector.inject(root);
            const end = perf_hooks_1.performance.now();
            totalTime += (end - start);
            successCount++;
            if (successCount % 20 === 0) {
                process.stdout.write('.');
            }
        }
        catch (e) {
            errorCount++;
            console.error(`\nFailed to process ${file}:`, e.message);
        }
    }
    console.log('\n');
    console.log(`[4/4] Complete.`);
    console.log(`----------------------------------------`);
    console.log(`Files Processed: ${xmlFiles.length}`);
    console.log(`Success: ${successCount}`);
    console.log(`Errors:  ${errorCount}`);
    console.log(`Total Parsing Time: ${totalTime.toFixed(2)}ms`);
    if (successCount > 0) {
        console.log(`Avg Time per File: ${(totalTime / successCount).toFixed(2)}ms`);
    }
}
main().catch(err => console.error(err));
//# sourceMappingURL=run-test.js.map