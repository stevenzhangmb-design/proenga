#!/usr/bin/env node
/* ════════════════════════════════════════════════════════════════════════
   后端工程脚手架发射器（Java+Spring）· emit-scaffold-java.js · 零依赖
   ────────────────────────────────────────────────────────────────────────
   把 emit-backend.js 出的【分层源码片段】升级成【开箱即 mvn compile 的工程】：
     ① 把扁平的 controller/dto/entity/mapper/service/vo/*.java 按 package 搬进 Maven 布局
        backend/src/main/java/<pkgPath>/...
     ② 补脚手架：pom.xml（Spring Boot 3 + MyBatis-Plus + Lombok + validation）
        + Application.java（@SpringBootApplication @MapperScan）
        + common/{TenantBasePO, Result, TextSearchHelper}.java（生成代码 extends/调用的 base 件）
        + application.yml
   base 件契约按 emit-backend 产出实测对齐：Result.success(data)/success()、
   TextSearchHelper.apply(wrapper,SFunction,String)、TenantBasePO.getId():Long。
   用法：node emit-scaffold-java.js <outDir> [basePackage=com.tf.gen]
   ════════════════════════════════════════════════════════════════════════ */
'use strict';
const fs = require('fs'), path = require('path');
const outDir = process.argv[2];
const basePkg = process.argv[3] || 'com.tf.gen';
if (!outDir) { console.error('用法: node emit-scaffold-java.js <outDir> [basePackage]'); process.exit(2); }
const beDir = path.join(outDir, 'backend');
if (!fs.existsSync(beDir)) { console.error('找不到 backend/ 目录：' + beDir); process.exit(1); }
const pkgPath = basePkg.replace(/\./g, '/');
const javaRoot = path.join(beDir, 'src', 'main', 'java');
const w = (p, c) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, c, 'utf8'); };

/* ① 把扁平 .java 按 package 声明搬进 Maven 布局（已在 src/ 下的跳过） */
let moved = 0;
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (path.resolve(p) === path.resolve(path.join(beDir, 'src'))) continue; walk(p); }
    else if (e.name.endsWith('.java')) {
      const txt = fs.readFileSync(p, 'utf8');
      const m = txt.match(/^\s*package\s+([\w.]+)\s*;/m);
      if (!m) continue;
      const dest = path.join(javaRoot, m[1].replace(/\./g, '/'), e.name);
      if (path.resolve(dest) === path.resolve(p)) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.renameSync(p, dest); moved++;
    }
  }
})(beDir);
// 清理搬空后的旧扁平目录（controller/dto/... 若已空）
for (const d of ['controller', 'dto', 'entity', 'mapper', 'service', 'vo']) {
  const p = path.join(beDir, d);
  try { fs.rmSync(p, { recursive: true, force: true }); } catch (e) {}
}

/* ② pom.xml */
w(path.join(beDir, 'pom.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
  <modelVersion>4.0.0</modelVersion>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.4</version>
    <relativePath/>
  </parent>
  <groupId>${basePkg}</groupId>
  <artifactId>backend</artifactId>
  <version>0.0.1-SNAPSHOT</version>
  <properties>
    <java.version>21</java.version>
    <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
  </properties>
  <dependencies>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-web</artifactId></dependency>
    <dependency><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-validation</artifactId></dependency>
    <dependency><groupId>com.baomidou</groupId><artifactId>mybatis-plus-spring-boot3-starter</artifactId><version>3.5.7</version></dependency>
    <dependency><groupId>org.projectlombok</groupId><artifactId>lombok</artifactId><optional>true</optional></dependency>
    <dependency><groupId>com.mysql</groupId><artifactId>mysql-connector-j</artifactId><scope>runtime</scope></dependency>
  </dependencies>
  <build>
    <plugins>
      <plugin>
        <groupId>org.apache.maven.plugins</groupId>
        <artifactId>maven-compiler-plugin</artifactId>
        <configuration>
          <annotationProcessorPaths>
            <path>
              <groupId>org.projectlombok</groupId>
              <artifactId>lombok</artifactId>
              <version>\${lombok.version}</version>
            </path>
          </annotationProcessorPaths>
        </configuration>
      </plugin>
      <plugin>
        <groupId>org.springframework.boot</groupId>
        <artifactId>spring-boot-maven-plugin</artifactId>
        <configuration>
          <excludes><exclude><groupId>org.projectlombok</groupId><artifactId>lombok</artifactId></exclude></excludes>
        </configuration>
      </plugin>
    </plugins>
  </build>
</project>
`);

/* ② Application.java */
w(path.join(javaRoot, pkgPath, 'Application.java'), `package ${basePkg};

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@MapperScan("${basePkg}.mapper")
public class Application {
    public static void main(String[] args) {
        SpringApplication.run(Application.class, args);
    }
}
`);

/* ② common/TenantBasePO —— 生成实体 extends 它；controller 调 po.getId():Long */
w(path.join(javaRoot, pkgPath, 'common', 'TenantBasePO.java'), `package ${basePkg}.common;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.FieldFill;
import lombok.Data;
import java.time.LocalDateTime;

/** 多租户基类：主键 + 租户隔离 + 审计字段（生成实体统一继承） */
@Data
public class TenantBasePO {
    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField(value = "tenant_id")
    private Long tenantId;

    @TableField(value = "create_time", fill = FieldFill.INSERT)
    private LocalDateTime createTime;

    @TableField(value = "update_time", fill = FieldFill.INSERT_UPDATE)
    private LocalDateTime updateTime;
}
`);

/* ② common/Result —— controller 统一返回：success(data) / success() / fail(msg) */
w(path.join(javaRoot, pkgPath, 'common', 'Result.java'), `package ${basePkg}.common;

import lombok.Data;

/** 统一返回体：code=0 成功。 */
@Data
public class Result<T> {
    private int code;
    private String msg;
    private T data;

    public static <T> Result<T> success(T data) {
        Result<T> r = new Result<>();
        r.setCode(0); r.setMsg("ok"); r.setData(data);
        return r;
    }

    public static Result<Void> success() {
        Result<Void> r = new Result<>();
        r.setCode(0); r.setMsg("ok");
        return r;
    }

    public static <T> Result<T> fail(String msg) {
        Result<T> r = new Result<>();
        r.setCode(1); r.setMsg(msg);
        return r;
    }
}
`);

/* ② common/TextSearchHelper —— service 调 apply(wrapper, SFunction, String) 做 LIKE 过滤 */
w(path.join(javaRoot, pkgPath, 'common', 'TextSearchHelper.java'), `package ${basePkg}.common;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.core.toolkit.support.SFunction;

/** 文本模糊查询助手：值非空才加 LIKE 条件（避免空串全表 LIKE）。 */
public final class TextSearchHelper {
    private TextSearchHelper() {}

    public static <T, R> void apply(LambdaQueryWrapper<T> wrapper, SFunction<T, R> column, String value) {
        if (value != null && !value.trim().isEmpty()) {
            wrapper.like(column, value.trim());
        }
    }
}
`);

/* ② application.yml（最小·mvn compile 不需连库；运行时改这里接真库） */
w(path.join(beDir, 'src', 'main', 'resources', 'application.yml'), `server:
  port: 8080
spring:
  application:
    name: ${basePkg}
# 运行时接真库再填 datasource；mvn compile 不需要。
# spring.datasource.url: jdbc:mysql://localhost:3306/db?useSSL=false&serverTimezone=Asia/Shanghai
# spring.datasource.username: root
# spring.datasource.password: ***
`);

console.log('✅ 后端工程脚手架已补 → ' + beDir);
console.log('   搬入 Maven 布局 .java: ' + moved + ' 个 · 补 pom + Application + common(3 base) + application.yml');
console.log('   下一步：cd ' + beDir + ' && mvn -q compile');
