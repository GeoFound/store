# Plugin Platform Task

目标：把当前“数字/虚拟商品单店方案”升级成一个可长期演进的热插拔插件化底座。这里的“热插拔”指能力层、路由层、UI 扩展层和策略层可以通过注册表与配置运行时切换；新插件包的代码交付仍然走正常发布，但接入、启停、替换、回退要尽量不改主流程。

## 现状

当前仓库已经有清晰的业务模块：

- `apps/backend/src/modules/payment-router`
- `apps/backend/src/modules/credential-inventory`
- `apps/backend/src/modules/digital-delivery`
- `apps/backend/src/modules/guest-order-access`
- `apps/backend/src/modules/support-audit`

也有明确的 API、Admin 路由、job、workflow 目录。

当前平台化边界已经落到代码中：

- 支付、库存、交付、商品履约策略、订单访问、Hook 都通过平台 contract 解析。
- 支付成功编排只调用 `inventory-handler`、`delivery-handler`、`order-access-provider`，不再直接写库存或交付模块内部状态。
- 支付通道只暴露已启用且 provider 已注册的 channel，未注册或禁用 provider 会被隐藏或明确拒绝，不会隐式走 `noop` 收款。
- 前台和后台 UI 扩展点通过 registry 挂载，并可随插件启停过滤。
- 商品模板带 `fulfillmentPolicyCode`、`deliveryHandlerCode`、`inventoryHandlerCode`，库存型和非库存型数字商品走不同能力组合。

仍需长期保持的约束：

- 新插件包仍走正常代码发布，不做运行时下载执行。
- 必需能力缺失时应明确失败；`noop` 只用于无库存商品、可选副作用或测试 harness，不用于伪造真实支付和交付成功。

## 目标

把系统拆成“平台能力 + 插件实现 + 编排层”三层：

- 平台能力只认契约，不认具体模块名。
- 插件实现可按能力启用/禁用。
- 编排层负责流程，不让模块互相直调。
- 插件可以声明依赖、版本、能力、迁移归属和默认启用状态。
- 停用可选插件时，平台必须能通过 fallback/no-op 保持非关键链路可运行；停用支付、库存、交付等必需能力时必须给出可读错误，不允许静默成功。

## 建议目录

- `apps/backend/src/platform/contracts`
- `apps/backend/src/platform/registry`
- `apps/backend/src/platform/runtime`
- `apps/backend/src/platform/hooks`
- `apps/backend/src/platform/extensions`
- `apps/backend/src/plugins/*`

保留现有 `src/modules/*`，作为第一批插件实现的承载目录也可以，但要补 manifest 和 capability 元数据。

## 必做项

### 1. 插件清单和发现

每个插件必须声明：

- `id`
- `version`
- `capabilities`
- `dependencies`
- `enabledByDefault`
- `migrationsOwner`

发现方式采用显式注册和 manifest 汇总，不做运行时文件扫描。

### 2. 能力注册表

平台层只通过能力名调用：

- `payment-provider`
- `inventory-handler`
- `delivery-handler`
- `order-access-provider`
- `product-policy`
- `storefront-slot`
- `admin-extension`
- `background-job`
- `hook-subscriber`

禁止业务代码直接依赖具体插件目录。

### 3. 版本化契约

所有插件接口要版本化：

- `createPayment`
- `handleWebhook`
- `finalizePayment`
- `createDelivery`
- `revokeAccess`
- `reserveInventory`
- `finalizeInventoryReservation`
- `issueOrderAccess`
- `resolveProductPolicy`
- `renderSlot`

版本不兼容时必须显式拒绝加载，并保留 fallback 实现。

### 4. 编排层

把以下流程从“模块互调”改成“workflow 编排”：

- 创建支付尝试
- 支付成功确认
- 占库/释放库存
- 创建交付
- 生成/撤销 guest access token

### 5. 事件和 Hook

把次级副作用改成事件消费，不在主流程里硬串：

- 审计写入
- 通知发送
- webhook 重试
- 订单恢复 token 处理

### 6. UI 扩展

前台和后台都要有扩展注册点：

- storefront theme slot
- admin route/widget slot
- plugin 自定义页面入口

### 7. 配置驱动商品模板

把“卖什么”从代码里抽出去：

- 虚拟卡密
- 账号密码
- license key
- 兑换码
- 文件下载
- 人工开通
- 外部 API 开通

每种商品都通过 `product template + fulfillment policy` 映射，不直接写死在订单流程里。

### 8. 关闭和回退

每个插件必须有：

- no-op/fallback adapter（仅用于可选链路或明确声明无库存/无交付的商品策略）
- 停用时的可读错误
- 数据迁移归属
- 回退测试

## 热插拔语义

- 已安装插件可以通过配置和注册表启用、禁用、替换。
- capability 路由必须支持多实现选择和优先级切换。
- 核心流程不能依赖单一插件实例的硬编码引用。
- 关闭可选插件后，系统必须自动降级到 fallback 或 no-op；关闭必需插件时必须在创建支付、预占库存或交付前明确失败。
- 新增一个插件包后，平台必须能通过 manifest 和注册表识别它的能力边界。

## 当前运行时控制

当前仓库已经支持这些运行时控制面：

- `PLATFORM_ENABLED_PLUGINS`
- `PLATFORM_DISABLED_PLUGINS`
- `PLATFORM_ENABLED_CONTRACTS`
- `PLATFORM_DISABLED_CONTRACTS`

其中 contract 开关格式为 `capability:name1,name2;capability:name3`，例如：

- `payment-provider:manual,alt`
- `delivery-handler:manual`

平台运行时已经支持：

- 先配置禁用，再注册插件或 contract
- 插件安装、替换、移除
- 替换失败自动回滚到上一快照
- 插件移除后的能力解析、可选 fallback/no-op 和必需能力错误
- Hook subscriber 会随插件启停过滤
- 通用支付 webhook 路由可按 provider code 分发
- 库存预占、支付完成确认、自动交付和订单访问撤销都走 capability contract
- 支付、库存、交付、订单访问、售后审计表已补关键唯一约束和查询索引

## 任务拆分

1. 建立平台层目录、manifest、capability registry。
2. 把 `payment-router` 改成标准 provider 插件模型。
3. 把 `digital-delivery` 和 `credential-inventory` 改成 handler/policy 插件模型。
4. 把支付成功、发货、token 发放改成 workflow 编排。
5. 把审计、通知、重试改成事件/Hook 消费。
6. 给 storefront 和 admin 加扩展注册点。
7. 抽出 product template / fulfillment policy。
8. 建插件安装、启停、版本校验和测试 harness。

## 验收标准

- 可以在配置中启用/禁用支付 provider、交付 handler、UI 扩展。
- 停用可选插件后，系统还能用 fallback 跑通非关键链路；停用支付、库存、交付等必需能力时会明确失败。
- 主流程不再直接依赖具体业务模块内部表。
- 新增一种数字商品类型，不需要改支付主流程。
- 新增一个后台页面或前台 slot，不需要改核心模块。
- 现有 unit/acceptance 测试继续通过。

## 非目标

- 不做公开插件市场或自动分发平台。
- 不重做 Medusa Admin。
- 不做多商户平台。
- 不做复杂中台化支付路由。
