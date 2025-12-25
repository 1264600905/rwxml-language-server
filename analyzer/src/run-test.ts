import { TypeInfoLoader } from './rimworld-types/typeInfoLoader';
import { TypeInfoInjector } from './rimworld-types/typeInfoInjector';
import { parse } from './parser';
import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import { performance } from 'perf_hooks';

// 配置路径
const METADATA_PATH = path.resolve(__dirname, '../../rimworld-defs-metadata-1.6.json');
// 注意：这里硬编码了你的路径，运行时请确保该路径存在
const TARGET_DIR = 'H:/SteamLibrary/steamapps/common/RimWorld/Data/Anomaly'; 

async function main() {
    console.log(`[1/4] Loading metadata from ${METADATA_PATH}...`);
    if (!fs.existsSync(METADATA_PATH)) {
        console.error('Error: Metadata file not found!');
        process.exit(1);
    }

    // 1. 加载元数据
    const buffer = fs.readFileSync(METADATA_PATH);
    let content = "";
    if (buffer[0] === 0xff && buffer[1] === 0xfe) {
        content = buffer.toString('utf16le');
    } else {
        content = buffer.toString('utf-8');
    }
    
    // 移除任何可能的 BOM (UTF-8 或 UTF-16)
    if (content.charCodeAt(0) === 0xFEFF) {
        content = content.slice(1);
    }
    
    // 移除可能的空白字符
    content = content.trim();
    
    const rawMetadata = JSON.parse(content);
    // 注意：TypeInfoLoader.load 返回的是 TypeInfoMap
    const typeInfoMap = TypeInfoLoader.load(rawMetadata);
    console.log(`Metadata loaded successfully.`);

    // 2. 扫描 XML 文件
    console.log(`[2/4] Scanning XML files in ${TARGET_DIR}...`);
    // 修正正则：\\ -> /
    const xmlPattern = `${TARGET_DIR.replace(/\\/g, '/')}/**/*.xml`;
    const xmlFiles = await fg(xmlPattern, { dot: true });
    
    if (xmlFiles.length === 0) {
        console.error('Error: No XML files found. Check the path or permissions.');
        try {
            console.log('Directory contents:', fs.readdirSync(TARGET_DIR));
        } catch(e: any) {
            console.log('Cannot list directory:', e.message);
        }
        process.exit(1);
    }
    console.log(`Found ${xmlFiles.length} XML files.`);

    // 3. 解析与校验
    console.log(`[3/4] Parsing and analyzing files...`);
    const injector = new TypeInfoInjector(typeInfoMap);
    
    let totalTime = 0;
    let successCount = 0;
    let errorCount = 0;

    for (const file of xmlFiles) {
        try {
            const content = fs.readFileSync(file, 'utf-8');
            const start = performance.now();
            
            // 解析 XML
            const root = parse(content, file);
            
            // 注入元数据
            injector.inject(root);
            
            const end = performance.now();
            totalTime += (end - start);
            successCount++;
            
            if (successCount % 20 === 0) {
                process.stdout.write('.');
            }
        } catch (e: any) {
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