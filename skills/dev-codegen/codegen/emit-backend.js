#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   阶段3 B · 后端 CRUD 四层骨架生成器 · emit-backend.js · 零依赖
   ────────────────────────────────────────────────────────────────────────
   输入：data_model + function_points.api（可选 fp.detail = {entity, fk, label} 主子表）
   输出（严格照 _shared/dev-stack-spec.md）：每个 fp 主实体一套四层 + DTO/VO/Query；
     若 fp.detail 存在（主子表·如入库单头+明细）：子实体出 PO/Mapper/IService/ServiceImpl/SaveReq/VO，
     主 SaveReq/VO 带 List<子> lines，主 ServiceImpl 带 @Transactional saveWithLines/updateWithLines（存头+批量存行）。
   类型映射：bigint→Long·int/tinyint→Integer·decimal→BigDecimal·date→LocalDate·datetime→LocalDateTime·varchar/text→String
   用法：node emit-backend.js <input.json> [outDir] [basePackage]
   L3：可跑 CRUD 骨架；业务逻辑/权限/状态前置校验/行 diff 那 20% 标 TODO（研发+AI 接力）。
   前提：项目已有基座 TenantBasePO / Result / TextSearchHelper / MyBatis-Plus 配置。
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const inPath = process.argv[2];
const outDir = process.argv[3] || path.join(path.dirname(inPath || '.'), 'out', 'backend');
const basePkg = process.argv[4] || 'com.tf.wms';
if (!inPath) { console.error('用法: node emit-backend.js <input.json> [outDir] [basePackage]'); process.exit(2); }
let doc; try { doc = JSON.parse(fs.readFileSync(inPath, 'utf8').replace(/^﻿/, '')); }
catch (e) { console.error('读取失败: ' + e.message); process.exit(2); }
const entities = (doc.data_model || {}).entities || {};
const fps = doc.function_points || {};

const camel = s => s.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
const cap = s => s[0].toUpperCase() + s.slice(1);
function javaType(c) {
  switch (c.type) {
    case 'bigint': return 'Long';
    case 'int': case 'tinyint': return 'Integer';
    case 'decimal': return 'BigDecimal';
    case 'date': return 'LocalDate';
    case 'datetime': return 'LocalDateTime';
    default: return 'String';
  }
}
const usesBig = cols => cols.some(c => c.type === 'decimal');
const usesDate = cols => cols.some(c => c.type === 'date' || c.type === 'datetime');
function fieldLines(cols, indent) {
  const p = ' '.repeat(indent);
  return cols.map(c => `${p}/** ${c.comment || ''} */\n${p}private ${javaType(c)} ${camel(c.col)};`).join('\n\n');
}

// ── entity ──
function poFile(ek, ent) {
  const Cap = cap(ek), cols = ent.columns;
  const imp = ['import com.baomidou.mybatisplus.annotation.TableName;', 'import lombok.Data;', 'import lombok.EqualsAndHashCode;', `import ${basePkg}.common.TenantBasePO;`];
  if (usesBig(cols)) imp.push('import java.math.BigDecimal;');
  if (usesDate(cols)) imp.push('import java.time.*;');
  return `package ${basePkg}.entity;

${imp.join('\n')}

/** ${ent.label || Cap} · ${ent.comment || ''}（生成骨架·只声明业务字段·id/租户/审计走基类） */
@Data
@EqualsAndHashCode(callSuper = true)
@TableName("${ent.table}")
public class ${Cap}PO extends TenantBasePO {

${fieldLines(cols, 4)}
}
`;
}
function mapperFile(ek) {
  const Cap = cap(ek);
  return `package ${basePkg}.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import ${basePkg}.entity.${Cap}PO;
import org.apache.ibatis.annotations.Mapper;

@Mapper
public interface ${Cap}Mapper extends BaseMapper<${Cap}PO> {
}
`;
}
function iServiceFile(ek, opts) {
  const Cap = cap(ek), md = opts && opts.detail;
  const extra = md ? `    Long saveWithLines(${Cap}SaveReq req);\n    void updateWithLines(Long id, ${Cap}SaveReq req);\n` : '';
  const imp = [`import com.baomidou.mybatisplus.extension.service.IService;`, `import com.baomidou.mybatisplus.extension.plugins.pagination.Page;`, `import ${basePkg}.entity.${Cap}PO;`];
  if (opts && opts.hasQuery) { imp.push(`import ${basePkg}.dto.${Cap}Query;`); imp.push(`import ${basePkg}.vo.${Cap}VO;`); }
  if (md) imp.push(`import ${basePkg}.dto.${Cap}SaveReq;`);
  const methods = (opts && opts.hasQuery) ? `    Page<${Cap}VO> pageList(${Cap}Query query);\n    ${Cap}VO detail(Long id);\n` : '';
  return `package ${basePkg}.service;

${imp.join('\n')}

public interface I${Cap}Service extends IService<${Cap}PO> {
${methods}${extra}}
`;
}
function serviceImplFile(ek, ent, opts) {
  const Cap = cap(ek), md = opts && opts.detail;
  const q = opts && opts.listQuery;
  const colByCamel = {}; ent.columns.forEach(c => colByCamel[camel(c.col)] = c);
  const conds = ((q && q.query) || []).filter(n => colByCamel[n]).map(n => {
    const c = colByCamel[n], getter = `${Cap}PO::get${cap(n)}`;
    if (c.type === 'varchar' || c.type === 'text' || c.type === 'char') return `        TextSearchHelper.apply(w, ${getter}, query.get${cap(n)}());`;
    return `        if (query.get${cap(n)}() != null) w.eq(${getter}, query.get${cap(n)}());`;
  }).join('\n');
  const imp = [
    'import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;',
    'import com.baomidou.mybatisplus.core.toolkit.Wrappers;',
    'import com.baomidou.mybatisplus.extension.plugins.pagination.Page;',
    'import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;',
    `import ${basePkg}.common.TextSearchHelper;`,
    `import ${basePkg}.entity.${Cap}PO;`,
    `import ${basePkg}.mapper.${Cap}Mapper;`,
    `import ${basePkg}.service.I${Cap}Service;`,
    'import org.springframework.beans.BeanUtils;',
    'import org.springframework.stereotype.Service;'
  ];
  if (opts && opts.hasQuery) { imp.push(`import ${basePkg}.dto.${Cap}Query;`, `import ${basePkg}.vo.${Cap}VO;`); }
  let body = '';
  if (opts && opts.hasQuery) {
    body += `
    @Override
    public Page<${Cap}VO> pageList(${Cap}Query query) {
        LambdaQueryWrapper<${Cap}PO> w = Wrappers.lambdaQuery();
${conds || '        // 无列表查询条件'}
        w.orderByDesc(${Cap}PO::getCreateTime);
        Page<${Cap}PO> page = baseMapper.selectPage(new Page<>(query.getPage(), query.getSize()), w);
        Page<${Cap}VO> vo = new Page<>(page.getCurrent(), page.getSize(), page.getTotal());
        vo.setRecords(page.getRecords().stream().map(po -> { ${Cap}VO v = new ${Cap}VO(); BeanUtils.copyProperties(po, v); return v; }).toList());
        return vo;
    }

    @Override
    public ${Cap}VO detail(Long id) {
        ${Cap}PO po = getById(id);
        if (po == null) return null;
        ${Cap}VO v = new ${Cap}VO();
        BeanUtils.copyProperties(po, v);
${md ? `        // 主子表：加载明细行
        LambdaQueryWrapper<${cap(md.entity)}PO> lw = Wrappers.lambdaQuery();
        lw.eq(${cap(md.entity)}PO::get${cap(camel(md.fk))}, id);
        v.setLines(${md.entity}Service.list(lw).stream().map(lp -> { ${cap(md.entity)}VO lv = new ${cap(md.entity)}VO(); BeanUtils.copyProperties(lp, lv); return lv; }).toList());
` : ''}        return v;
    }
`;
  }
  if (md) {
    const DCap = cap(md.entity), fkSetter = 'set' + cap(camel(md.fk));
    imp.push('import org.springframework.transaction.annotation.Transactional;', 'import jakarta.annotation.Resource;',
      `import ${basePkg}.dto.${Cap}SaveReq;`, `import ${basePkg}.entity.${DCap}PO;`, `import ${basePkg}.service.I${DCap}Service;`,
      `import ${basePkg}.vo.${DCap}VO;`, 'import java.util.List;', 'import java.util.stream.Collectors;');
    body += `
    @Resource
    private I${DCap}Service ${md.entity}Service;

    @Override
    @Transactional(rollbackFor = Exception.class)
    public Long saveWithLines(${Cap}SaveReq req) {
        ${Cap}PO po = new ${Cap}PO();
        BeanUtils.copyProperties(req, po);
        save(po);                                     // TODO 单号生成/业务校验
        saveLines(po.getId(), req);
        return po.getId();
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public void updateWithLines(Long id, ${Cap}SaveReq req) {
        ${Cap}PO po = new ${Cap}PO();
        BeanUtils.copyProperties(req, po);
        po.setId(id);
        updateById(po);                               // TODO 状态前置校验
        ${md.entity}Service.remove(Wrappers.<${DCap}PO>lambdaQuery().eq(${DCap}PO::get${cap(camel(md.fk))}, id));
        saveLines(id, req);                           // TODO 行级 diff（保留 id 增量更新）而非全删重插
    }

    private void saveLines(Long headId, ${Cap}SaveReq req) {
        if (req.getLines() == null || req.getLines().isEmpty()) return;
        List<${DCap}PO> lines = req.getLines().stream().map(l -> {
            ${DCap}PO lp = new ${DCap}PO();
            BeanUtils.copyProperties(l, lp);
            lp.${fkSetter}(headId);
            return lp;
        }).collect(Collectors.toList());
        ${md.entity}Service.saveBatch(lines);
    }
`;
  }
  return `package ${basePkg}.service.impl;

${imp.join('\n')}

@Service
public class ${Cap}ServiceImpl extends ServiceImpl<${Cap}Mapper, ${Cap}PO> implements I${Cap}Service {
${body}}
`;
}
function controllerFile(ek, ent, fpk, api, opts) {
  const Cap = cap(ek), base = (api.list || api.create || {}).path || `/api/${ek}`, md = opts && opts.detail;
  const createBody = md
    ? `        return Result.success(${ek}Service.saveWithLines(req));`
    : `        ${Cap}PO po = new ${Cap}PO();\n        BeanUtils.copyProperties(req, po);\n        ${ek}Service.save(po);        // TODO 业务校验/唯一性\n        return Result.success(po.getId());`;
  const updateBody = md
    ? `        ${ek}Service.updateWithLines(id, req);\n        return Result.success();`
    : `        ${Cap}PO po = new ${Cap}PO();\n        BeanUtils.copyProperties(req, po);\n        po.setId(id);\n        ${ek}Service.updateById(po);   // TODO 状态前置校验\n        return Result.success();`;
  const imp = [`import ${basePkg}.common.Result;`, 'import com.baomidou.mybatisplus.extension.plugins.pagination.Page;',
    `import ${basePkg}.dto.${Cap}Query;`, `import ${basePkg}.dto.${Cap}SaveReq;`, `import ${basePkg}.service.I${Cap}Service;`,
    `import ${basePkg}.vo.${Cap}VO;`, 'import jakarta.annotation.Resource;', 'import jakarta.validation.Valid;', 'import org.springframework.web.bind.annotation.*;'];
  if (!md) imp.push(`import ${basePkg}.entity.${Cap}PO;`, 'import org.springframework.beans.BeanUtils;');
  return `package ${basePkg}.controller;

${imp.join('\n')}

/** ${fpk} · ${ent.label || Cap}（生成 CRUD 骨架·方法体 TODO 交研发/AI 补业务逻辑） */
@RestController
@RequestMapping("${base}")
public class ${Cap}Controller {

    @Resource
    private I${Cap}Service ${ek}Service;

    /** 列表 */
    @GetMapping
    public Result<Page<${Cap}VO>> list(${Cap}Query query) {
        return Result.success(${ek}Service.pageList(query));
    }

    /** 详情 */
    @GetMapping("/{id}")
    public Result<${Cap}VO> detail(@PathVariable Long id) {
        return Result.success(${ek}Service.detail(id));
    }

    /** 新增 */
    @PostMapping
    public Result<Long> create(@RequestBody @Valid ${Cap}SaveReq req) {
${createBody}
    }

    /** 编辑 */
    @PutMapping("/{id}")
    public Result<Void> update(@PathVariable Long id, @RequestBody @Valid ${Cap}SaveReq req) {
${updateBody}
    }

    /** 删除（逻辑删除） */
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        ${ek}Service.removeById(id);   // TODO 状态前置：状态不符应拦截
        return Result.success();
    }
}
`;
}
function saveReqFile(ek, ent, opts) {
  const Cap = cap(ek), md = opts && opts.detail, ex = (opts && opts.exclude) || null;
  const cols = ent.columns.filter(c => c.col !== ex);
  const imp = ['import lombok.Data;'];
  if (cols.some(c => !c.nullable)) imp.push('import jakarta.validation.constraints.NotNull;');
  if (cols.some(c => c.type === 'varchar' && c.len)) imp.push('import jakarta.validation.constraints.Size;');
  if (usesBig(cols)) imp.push('import java.math.BigDecimal;');
  if (usesDate(cols)) imp.push('import java.time.*;');
  if (md) imp.push('import java.util.List;');
  const fields = cols.map(c => {
    const ann = [];
    if (!c.nullable) ann.push(`    @NotNull(message = "${c.comment || camel(c.col)}不能为空")`);
    if (c.type === 'varchar' && c.len) ann.push(`    @Size(max = ${c.len}, message = "${c.comment || camel(c.col)}超长")`);
    return `    /** ${c.comment || ''} */\n${ann.length ? ann.join('\n') + '\n' : ''}    private ${javaType(c)} ${camel(c.col)};`;
  }).join('\n\n');
  const lines = md ? `\n\n    /** ${md.label || '明细行'} */\n    private List<${cap(md.entity)}SaveReq> lines;` : '';
  return `package ${basePkg}.dto;

${imp.join('\n')}

/** ${ent.label || Cap} 新增/编辑请求 */
@Data
public class ${Cap}SaveReq {

${fields}${lines}
}
`;
}
function voFile(ek, ent, opts) {
  const Cap = cap(ek), cols = ent.columns, md = opts && opts.detail;
  const imp = ['import lombok.Data;'];
  if (usesBig(cols)) imp.push('import java.math.BigDecimal;');
  imp.push('import java.time.*;');   // ← LocalDateTime(审计) + 业务 date 字段的 LocalDate 都覆盖(旧只 import LocalDateTime → date 业务字段 LocalDate 找不到符号)
  if (md) imp.push('import java.util.List;');
  const lines = md ? `\n\n    /** ${md.label || '明细行'} */\n    private List<${cap(md.entity)}VO> lines;` : '';
  return `package ${basePkg}.vo;

${imp.join('\n')}

/** ${ent.label || Cap} 展示对象 */
@Data
public class ${Cap}VO {

    /** 主键 */
    private Long id;

${fieldLines(cols, 4)}

    /** 创建时间 */
    private LocalDateTime createTime;

    /** 更新时间 */
    private LocalDateTime updateTime;${lines}
}
`;
}
function queryFile(ek, ent, api) {
  const Cap = cap(ek), colByCamel = {}; ent.columns.forEach(c => colByCamel[camel(c.col)] = c);
  const qs = ((api.list && api.list.query) || []).filter(n => colByCamel[n]);
  const imp = ['import lombok.Data;'];
  if (qs.some(n => colByCamel[n].type === 'decimal')) imp.push('import java.math.BigDecimal;');
  const fields = qs.map(n => `    /** ${colByCamel[n].comment || ''} */\n    private ${javaType(colByCamel[n])} ${n};`).join('\n\n');
  return `package ${basePkg}.dto;

${imp.join('\n')}

/** ${ent.label || Cap} 列表查询参数 */
@Data
public class ${Cap}Query {
    private Integer page = 1;
    private Integer size = 10;

${fields}
}
`;
}

// ── 写出 ──
fs.mkdirSync(outDir, { recursive: true });
const write = (sub, name, content) => { const d = path.join(outDir, sub); fs.mkdirSync(d, { recursive: true }); fs.writeFileSync(path.join(d, name), content); };
let count = 0;
function genMaster(ek, ent, fpk, api, detail) {
  const Cap = cap(ek), opts = { detail, listQuery: api.list, hasQuery: true };
  write('entity', `${Cap}PO.java`, poFile(ek, ent));
  write('mapper', `${Cap}Mapper.java`, mapperFile(ek));
  write('service', `I${Cap}Service.java`, iServiceFile(ek, opts));
  write('service/impl', `${Cap}ServiceImpl.java`, serviceImplFile(ek, ent, opts));
  write('controller', `${Cap}Controller.java`, controllerFile(ek, ent, fpk, api, opts));
  write('dto', `${Cap}SaveReq.java`, saveReqFile(ek, ent, opts));
  write('dto', `${Cap}Query.java`, queryFile(ek, ent, api));
  write('vo', `${Cap}VO.java`, voFile(ek, ent, opts));
  count += 8;
  return `${Cap}(主): PO/Mapper/IService/ServiceImpl/Controller/SaveReq/Query/VO (8)`;
}
function genDetail(md) {
  const ek = md.entity, ent = entities[ek]; if (!ent) return `⚠ 子实体 ${ek} 未定义`;
  const Cap = cap(ek), opts = { exclude: md.fk, hasQuery: false };  // 子 SaveReq 不含主外键(由主设置)
  write('entity', `${Cap}PO.java`, poFile(ek, ent));
  write('mapper', `${Cap}Mapper.java`, mapperFile(ek));
  write('service', `I${Cap}Service.java`, iServiceFile(ek, { hasQuery: false }));
  write('service/impl', `${Cap}ServiceImpl.java`, serviceImplFile(ek, ent, { hasQuery: false }));
  write('dto', `${Cap}SaveReq.java`, saveReqFile(ek, ent, opts));
  write('vo', `${Cap}VO.java`, voFile(ek, ent, {}));
  count += 6;
  return `${Cap}(子): PO/Mapper/IService/ServiceImpl/SaveReq/VO (6)`;
}
for (const [fpk, fp] of Object.entries(fps)) {
  const ek = fp.entity, ent = entities[ek];
  if (!ent) { console.log(`  ⚠ ${fpk} 的 entity ${ek} 不存在，跳过`); continue; }
  const detail = fp.detail && entities[fp.detail.entity] ? fp.detail : null;
  console.log('  ✓ ' + genMaster(ek, ent, fpk, fp.api || {}, detail));
  if (detail) console.log('  ✓ ' + genDetail(detail));
}
console.log('\n════════ 后端 CRUD 四层骨架生成器（阶段3B）════════');
console.log(`  包名 ${basePkg} · 生成 ${count} 个 .java → ${outDir}`);
console.log('  L3：可跑 CRUD 骨架·方法体标 TODO（业务逻辑/权限/状态前置/行diff 交研发+AI 接力）');
console.log('════════════════════════════════════════════════\n');
process.exit(0);
