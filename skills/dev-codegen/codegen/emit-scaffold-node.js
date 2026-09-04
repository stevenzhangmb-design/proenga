#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   后端工程脚手架发射器（Node·NestJS+TypeORM）· emit-scaffold-node.js
   ────────────────────────────────────────────────────────────────────────
   把 emit-backend-node.js 出的 <entity>/*.ts（module/entity/service/controller/dto）
   补成【开箱即 tsc 编译 / nest 启动】的工程：
     · common/tenant-base.entity.ts —— 生成实体 extends 它（id/tenantId/createTime/updateTime·TypeORM 装饰器）
     · app.module.ts —— TypeOrmModule.forRoot(sqlite·autoLoadEntities) + 扫所有 *.module.ts 自动 imports
     · main.ts —— NestFactory bootstrap
     · package.json（@nestjs/* + typeorm + typescript…）+ tsconfig.json（装饰器元数据）
   base 契约按 emit-backend-node 产出对齐：entity `from '../common/tenant-base.entity'`。
   用法：node emit-scaffold-node.js <outDir>
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const outDir = process.argv[2];
if (!outDir) { console.error('用法: node emit-scaffold-node.js <outDir>'); process.exit(2); }
const beDir = path.join(outDir, 'backend');
if (!fs.existsSync(beDir)) { console.error('找不到 backend 目录：' + beDir); process.exit(1); }
const w = (p, c) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, 'utf8'); };

// common/tenant-base.entity.ts —— 生成实体的基类
w(path.join(beDir, 'common', 'tenant-base.entity.ts'), `import { PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm'

/** 多租户基类：主键 + 租户隔离 + 审计（生成实体统一继承）。 */
export abstract class TenantBaseEntity {
  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number

  @Column({ name: 'tenant_id', type: 'bigint', nullable: true })
  tenantId: number

  @CreateDateColumn({ name: 'create_time' })
  createTime: Date

  @UpdateDateColumn({ name: 'update_time' })
  updateTime: Date
}
`);

// 扫所有 *.module.ts（排除 app.module.ts）→ 相对 backend 的导入路径 + 类名
const modules = [];
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name === 'node_modules' || e.name === 'dist') continue; walk(p); }
    else if (e.name.endsWith('.module.ts') && e.name !== 'app.module.ts') {
      const txt = fs.readFileSync(p, 'utf8');
      const m = txt.match(/export\s+class\s+(\w+Module)/);
      if (m) { let rel = './' + path.relative(beDir, p).replace(/\\/g, '/').replace(/\.ts$/, ''); modules.push({ cls: m[1], rel }); }
    }
  }
})(beDir);

// app.module.ts
const modImports = modules.map(m => `import { ${m.cls} } from '${m.rel}'`).join('\n');
const modList = modules.map(m => m.cls).join(', ');
w(path.join(beDir, 'app.module.ts'), `import { Module } from '@nestjs/common'
import { TypeOrmModule } from '@nestjs/typeorm'
${modImports}

@Module({
  imports: [
    // 零配置 sqlite：开箱即跑；接真库改 type/host/... 或换 mysql2。
    TypeOrmModule.forRoot({ type: 'better-sqlite3', database: 'app.db', autoLoadEntities: true, synchronize: true }),
    ${modList},
  ],
})
export class AppModule {}
`);

// main.ts
w(path.join(beDir, 'main.ts'), `import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from './app.module'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)
  await app.listen(3000)
}
bootstrap()
`);

// package.json
w(path.join(beDir, 'package.json'), JSON.stringify({
  name: 'backend', private: true, version: '0.0.1',
  scripts: { build: 'tsc -p tsconfig.json', start: 'node dist/main.js', typecheck: 'tsc --noEmit -p tsconfig.json' },
  dependencies: {
    '@nestjs/common': '^10.3.0', '@nestjs/core': '^10.3.0', '@nestjs/platform-express': '^10.3.0',
    '@nestjs/typeorm': '^10.0.2', typeorm: '^0.3.20', 'reflect-metadata': '^0.2.2', rxjs: '^7.8.1',
    'class-validator': '^0.14.1', 'class-transformer': '^0.5.1', 'better-sqlite3': '^11.0.0',
  },
  devDependencies: { typescript: '^5.4.0', '@types/node': '^20.11.0' },
}, null, 2) + '\n');

// tsconfig.json（NestJS 标准·装饰器元数据）
w(path.join(beDir, 'tsconfig.json'), JSON.stringify({
  compilerOptions: {
    module: 'commonjs', target: 'ES2021', lib: ['ES2021'],
    experimentalDecorators: true, emitDecoratorMetadata: true,
    esModuleInterop: true, skipLibCheck: true, strict: false,
    moduleResolution: 'node', outDir: './dist', declaration: false, sourceMap: false,
  },
  exclude: ['node_modules', 'dist'],
}, null, 2) + '\n');

console.log('✅ Node(NestJS) 后端工程脚手架已补 → ' + beDir);
console.log('   补 common/tenant-base.entity + app.module(自动 imports ' + modules.length + ' 个 module) + main.ts + package.json + tsconfig.json');
console.log('   下一步：cd ' + beDir + ' && npm install && npm run build');
