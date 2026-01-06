
import { TypeInfoLoader } from './rimworld-types/typeInfoLoader';
import { TypeInfoInjector } from './rimworld-types/typeInfoInjector';
import { TypedElement } from './rimworld-types/typedElement';
import { parse } from './parser';
import { Element, Document } from './parser/domhandler';
import * as fs from 'fs';
import * as path from 'path';
import fg from 'fast-glob';
import { performance } from 'perf_hooks';

// 配置路径
const METADATA_PATH = path.resolve(__dirname, '../../rimworld-defs-metadata-1.6.json');
const TARGET_DIR = 'D:/RimworldProject/rwxml-language-server-master/测试XML'; 

function validate(node: Element, errors: string[]) {
    // 检查当前节点是否被识别
    const typedNode = node as unknown as TypedElement;
    if (!typedNode.typeInfo) {
        // 如果是 Defs 根节点或其直接子节点（Def类型）未识别，报错
        // 或者如果父节点已经识别了，但子节点没识别（说明字段名错了）
        const parent = node.parent as any;
        if (parent && parent.typeInfo) {
             errors.push(`[Error] Unknown field <${node.name}> in ${parent.typeInfo.className} at ${node.nodeRange.start}`);
        } else if (node.name !== 'Defs') {
             errors.push(`[Error] Unknown Def type <${node.name}> at ${node.nodeRange.start}`);
        }
    }

    // 递归检查子节点
    for (const child of node.ChildElementNodes) {
        validate(child, errors);
    }
}

async function main() {
    console.log(`[1/4] Loading metadata from ${METADATA_PATH}...`);
    const buffer = fs.readFileSync(METADATA_PATH);
    let content = buffer[0] === 0xff && buffer[1] === 0xfe ? buffer.toString('utf16le') : buffer.toString('utf-8');
    if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
    const rawMetadata = JSON.parse(content.trim());
    const typeInfoMap = TypeInfoLoader.load(rawMetadata);
    console.log(`Metadata loaded.`);

    console.log(`[2/4] Scanning XML files in ${TARGET_DIR}...`);
    const xmlPattern = `${TARGET_DIR.replace(/\\/g, '/')}/**/*.xml`;
    const xmlFiles = await fg(xmlPattern, { dot: true });
    console.log(`Found ${xmlFiles.length} XML files.`);

    console.log(`[3/4] Strict Validating...`);
    const injector = new TypeInfoInjector(typeInfoMap);
    
    let successCount = 0;
    let failCount = 0;

    for (const file of xmlFiles) {
        console.log(`\nAnalyzing: ${path.basename(file)}`);
        try {
            const content = fs.readFileSync(file, 'utf-8');
            const root = parse(content, file);
            injector.inject(root);

            // 执行严格校验
            const fileErrors: string[] = [];
            const defsNode = root.children.find(n => n instanceof Element && n.name === 'Defs') as Element;
            if (defsNode) {
                validate(defsNode, fileErrors);
            }

            if (fileErrors.length > 0) {
                console.log(`❌ Found ${fileErrors.length} errors:`);
                fileErrors.slice(0, 10).forEach(e => console.log(`  ${e}`));
                if (fileErrors.length > 10) console.log(`  ... and ${fileErrors.length - 10} more.`);
                failCount++;
            } else {
                console.log(`✅ No errors found.`);
                successCount++;
            }
        } catch (e: any) {
            console.error(`  Critical Error:`, e.message);
            failCount++;
        }
    }

    console.log(`\n----------------------------------------`);
    console.log(`Total: ${xmlFiles.length} | Passed: ${successCount} | Failed: ${failCount}`);
}

main().catch(err => console.error(err));
