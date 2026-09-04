#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   后端工程脚手架发射器（Python·FastAPI+SQLAlchemy）· emit-scaffold-python.js
   ────────────────────────────────────────────────────────────────────────
   把 emit-backend-python.js 出的 app/{models,routers,schemas}/*.py 片段，
   补成【开箱即 `uvicorn app.main:app` / 可 import】的工程：
     · app/db.py —— Base(declarative) + TenantBase(混入 id/tenant_id/create_time/update_time) + engine(sqlite零配置) + SessionLocal + get_db
     · app/main.py —— FastAPI() + 扫 routers 自动 include_router + create_all
     · requirements.txt —— fastapi/uvicorn/sqlalchemy/pydantic
     · 各层 __init__.py（包可导入）
   base 契约按 emit-backend-python 产出对齐：model `from app.db import Base, TenantBase`、
   router `from app.db import get_db`、字段用 create_time(审计·由 TenantBase 供)。
   用法：node emit-scaffold-python.js <outDir>
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const outDir = process.argv[2];
if (!outDir) { console.error('用法: node emit-scaffold-python.js <outDir>'); process.exit(2); }
const beDir = path.join(outDir, 'backend');
const appDir = path.join(beDir, 'app');
if (!fs.existsSync(appDir)) { console.error('找不到 backend/app 目录：' + appDir); process.exit(1); }
const w = (p, c) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, 'utf8'); };
const touchInit = (d) => { const p = path.join(d, '__init__.py'); if (!fs.existsSync(p)) fs.writeFileSync(p, '', 'utf8'); };

// 各层 __init__.py（含子目录）
touchInit(appDir);
for (const sub of ['models', 'routers', 'schemas']) { const d = path.join(appDir, sub); if (fs.existsSync(d)) touchInit(d); }

// app/db.py —— Base + TenantBase 混入 + engine(sqlite) + get_db
w(path.join(appDir, 'db.py'), `from sqlalchemy import create_engine, Column, BigInteger, DateTime, func
from sqlalchemy.orm import declarative_base, sessionmaker

# 零配置 sqlite：开箱即可 import/run；接真库改这行 DATABASE_URL（如 mysql+pymysql://...）。
DATABASE_URL = "sqlite:///./app.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {})
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


class TenantBase:
    """多租户基类混入：主键 + 租户隔离 + 审计（生成模型统一混入·业务字段只声明自己的）。"""
    id = Column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id = Column(BigInteger, index=True, nullable=True)
    create_time = Column(DateTime, server_default=func.now())
    update_time = Column(DateTime, server_default=func.now(), onupdate=func.now())


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
`);

// 扫 routers/*.py（排除 __init__）→ 模块名
let routerMods = [];
try {
  routerMods = fs.readdirSync(path.join(appDir, 'routers'))
    .filter(f => f.endsWith('.py') && f !== '__init__.py')
    .map(f => f.slice(0, -3));
} catch (e) {}

// app/main.py —— FastAPI + 自动 include 所有 router + 建表
const importLines = routerMods.map(m => `from app.routers import ${m} as _r_${m}`).join('\n');
const includeLines = routerMods.map(m => `app.include_router(_r_${m}.router)`).join('\n');
w(path.join(appDir, 'main.py'), `from fastapi import FastAPI
from app.db import Base, engine
${importLines}

# 建表（sqlite 开箱即用；生产用 Alembic 迁移替代）
Base.metadata.create_all(bind=engine)

app = FastAPI(title="生成后端 · FastAPI", description="Route B 生成骨架·业务逻辑 TODO 交研发/AI 补")

${includeLines}


@app.get("/health")
def health():
    return {"status": "ok"}
`);

// requirements.txt
w(path.join(beDir, 'requirements.txt'), `fastapi>=0.110
uvicorn[standard]>=0.29
SQLAlchemy>=2.0
pydantic>=2.6
`);

console.log('✅ Python 后端脚手架已补 → ' + beDir);
console.log('   补 app/db.py(Base+TenantBase+get_db·sqlite) + app/main.py(自动 include ' + routerMods.length + ' 个 router) + requirements.txt + __init__.py');
console.log('   下一步：cd ' + beDir + ' && pip install -r requirements.txt && uvicorn app.main:app');
