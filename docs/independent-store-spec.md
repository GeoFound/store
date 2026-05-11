# 单店自营虚拟商品独立站规格说明

## 1. 项目目标

本项目建设一个“单店自营”的虚拟商品独立站，用于销售虚拟商品、卡密、账号类库存或其他可数字化交付的商品。

项目定位是“小麻雀五脏俱全”：规模不大，但购买链路、支付、库存、交付、售后、后台管理、审计这些关键能力必须完整；架构不追求平台化和微服务化，但模块边界要清楚，后续能持续干净迭代。

第一版目标不是做大型电商平台，而是完成一条稳定的闭环：

- 用户能浏览商品。
- 用户能下单并支付。
- 系统能记录支付结果。
- 后台能管理商品、订单、客户。
- 后台能管理虚拟库存凭证。
- 后台能交付虚拟商品。
- 用户不登录也能查看自己的订单和交付内容。
- 出现问题时后台能备注、补发或退款记录。

第一版保持简单，但关键位置保留长期扩展能力，尤其是支付通道、库存凭证、订单交付三部分。

### 1.1 架构目标

本项目采用“模块化单体”作为第一版架构。

它不是多商户平台，也不是复杂支付中台；它是一个边界清晰、职责明确、可插件化扩展的独立站。

核心目标：

- 小站体量，功能完整。
- 单店自营，不支持多商户。
- 商品、订单、客户使用 Medusa 原生能力。
- 虚拟库存、交付、支付通道使用自定义模块补齐。
- 支付通道可插拔，但第一版不做复杂自动路由。
- 后台优先复用 Medusa Admin，只补业务必要页面。
- 每个模块有明确职责，不互相硬改数据。
- 后续加功能时新增模块、provider 或 handler，尽量不改主链路。

## 2. 技术选型

| 层级 | 技术 | 用途 |
| --- | --- | --- |
| 前台商城 | Next.js | 商品展示、购物车、游客结账、订单查询 |
| 后端电商 | Medusa | 商品、购物车、订单、客户、Admin、Payment Provider |
| 后台管理 | Medusa Admin | 第一版直接使用自带后台，只增加少量自定义页面 |
| 数据库 | PostgreSQL | 业务数据、订单、库存凭证、支付记录 |
| 缓存/队列 | Redis | 异步任务、支付轮询、库存锁释放、webhook 重试 |
| 文件/日志 | 本地或对象存储 | 后续保存导入文件、审计导出文件 |

### 2.1 基本原则

- Medusa 原生能力优先，不重写商品、订单、客户后台。
- 自定义模块只补 Medusa 不直接覆盖的虚拟商品业务。
- PostgreSQL 是唯一事实源，Redis 不保存最终业务状态。
- 支付插件化保留统一接口，但第一版只接少量通道。
- 凭证内容加密保存，不长期明文存储账号密码或卡密。

## 3. 系统架构

```text
用户浏览器
  |
  | HTTPS
  v
Next.js Storefront
  |
  | Medusa Store API
  v
Medusa Backend + Admin
  |
  | PostgreSQL
  v
业务数据

Medusa Backend
  |
  | Redis Queue
  v
异步任务：支付轮询 / webhook 重试 / 库存释放 / 自动交付

Medusa Backend
  |
  | Payment Provider
  v
支付通道：微信支付宝聚合 / 加密货币 / 人工确认
```

### 3.1 模块边界

第一版保持模块化单体，不拆微服务，但代码和数据职责必须拆清楚。

| 边界 | 负责内容 | 不负责内容 |
| --- | --- | --- |
| Medusa 商品模块 | 商品、分类、规格、价格 | 不保存真实卡密或账号凭证 |
| Medusa 订单模块 | 订单、订单明细、客户购买记录 | 不保存最终交付内容 |
| credential-inventory | 虚拟库存、凭证加密、库存状态 | 不处理支付回调 |
| digital-delivery | 交付记录、交付内容快照、补发 | 不决定支付是否成功 |
| payment-router | 支付通道、支付尝试、webhook、查询补偿 | 不直接修改凭证明文 |
| Admin UI | 后台操作界面 | 不写核心业务状态机 |
| Storefront | 用户购买和查看订单 | 不直接访问数据库 |

### 3.2 插件化边界

第一版只在真正需要扩展的位置做插件化。

| 插件点 | 第一版实现 | 后续扩展 |
| --- | --- | --- |
| Payment Provider | 聚合支付、加密货币、人工支付 | Stripe、PayPal、更多聚合支付、更多 crypto provider |
| Inventory Handler | 凭证库存预占、售出、释放、可售查询 | 文件库存、外部权益库存、无需库存商品 |
| Delivery Handler | 手动交付、库存凭证交付 | 自动交付、API 开通、兑换码、文件下载 |
| Product Policy | 商品模板到履约/库存/交付策略映射 | 按站点、商品类型、渠道切换履约策略 |
| Order Access Provider | 游客订单访问、找回、吊销 | 客户账号绑定、magic link、外部身份系统 |
| Hook Subscriber | 审计、通知、观测 | webhook 重试、异步补偿、风控 |
| Admin UI Route | 凭证库存、交付管理、支付通道 | 售后工单、对账、报表、风控 |
| Background Job | 支付轮询、库存释放、webhook 重试 | 自动对账、自动补发、通道健康检查 |

不做无意义抽象：

- 不为未来未知业务提前拆十几个模块。
- 不把支付做成复杂路由中台。
- 不重写 Medusa 已经做好的商品、订单、客户后台。
- 不把所有配置都做成后台动态配置，密钥仍然放环境变量或 secret manager。

### 3.3 干净迭代规则

后续开发必须遵守以下规则：

- 新支付方式只新增 payment provider，不改订单主流程。
- 新库存方式只新增 inventory handler，不改结账或支付完成主流程。
- 新交付方式只新增 delivery handler，不改支付模块。
- 新游客访问方式只新增 order access provider，不改支付或交付模块。
- 新后台页面只调用模块 API，不直接写数据库。
- 凭证明文只能通过 credential-inventory 模块解密。
- 支付成功只能先更新 payment_attempt，再触发订单和交付流程。
- webhook 必须幂等，不能重复发货。
- 订单记录和交付记录分开保存，补发不覆盖原始交付记录。
- Redis 只做任务和临时锁，最终状态必须落 PostgreSQL。
- 敏感字段访问必须写 audit_logs。
- 任何模块不得绕过 service/workflow 直接修改其他模块的状态字段。

这套规则的目标是让项目保持“小而清楚”：功能可以逐步加，但核心链路不会越改越乱。

## 4. 第一版范围

### 4.1 包含

- 商品列表、商品详情、分类浏览。
- 购物车和结账。
- 游客购买、邮箱下单、订单查询。
- Medusa Admin 商品、订单、客户管理。
- 虚拟库存凭证导入、查看、锁定、售出、交付。
- 支付通道选择。
- 支付 webhook 处理。
- 支付轮询补偿。
- 订单交付记录。
- 基础售后记录。
- 基础后台操作审计。

### 4.2 暂不包含

- 多商户。
- 分销系统。
- 内容社区。
- 复杂 CMS。
- 复杂风控评分系统。
- 大型支付路由中台。
- 独立重做 Admin。
- 多仓库实物发货。
- App 内购。

## 5. 前台页面

第一版前台只做 6 类页面，购买默认不要求登录。

### 5.1 首页

用途：展示主推商品、分类入口、基础公告。

内容：

- 商品分类入口。
- 推荐商品列表。
- 最近上架商品。
- 简单站点公告。

### 5.2 分类页

用途：按分类展示商品。

内容：

- 分类筛选。
- 商品卡片。
- 排序：默认、价格低到高、价格高到低、最新。
- 缺货商品标识。

### 5.3 商品页

用途：展示商品信息并加入购物车。

内容：

- 商品标题。
- 商品价格。
- 商品规格。
- 库存状态。
- 商品说明。
- 交付方式。
- 发货时间。
- 售后规则。
- 加入购物车按钮。
- 立即购买按钮。

商品页不做复杂评论、问答、社区内容。

### 5.4 购物车

用途：确认商品和数量。

内容：

- 商品列表。
- 单价。
- 数量。
- 小计。
- 总价。
- 去结账按钮。

虚拟商品库存有限时，购物车数量不能超过可售库存。

### 5.5 结账页

用途：确认订单并选择支付方式。

内容：

- 订单商品。
- 金额。
- 收货邮箱。
- 支付方式选择。
- 创建订单按钮。
- 支付跳转或二维码展示。

结账规则：

- 不要求用户登录。
- 不要求用户注册。
- 必须填写邮箱，用于创建游客 customer、接收订单信息、找回订单。
- 可选填写 Telegram、Discord 或备注，但第一版不作为必填项。
- 支付完成后生成订单访问令牌，用于游客查看订单和交付内容。

第一版支持三类支付入口：

- 微信 / 支付宝 / 银行卡通道。
- USDT / 加密货币通道。
- 人工付款通道。

### 5.6 订单查询

用途：游客或已登录用户查看订单和交付内容。

内容：

- 订单查询。
- 订单详情。
- 支付状态。
- 交付状态。
- 已交付内容。
- 售后入口。

游客订单访问方式：

- 支付完成页直接展示订单入口。
- 浏览器本地保存订单访问令牌。
- 用户可通过邮箱 + 订单号找回订单。
- 找回订单时发送一次性验证码或魔法链接。
- 不允许只凭订单号直接查看交付内容。

已登录账户是可选增强：

- 用户可以注册或登录后绑定历史订单。
- 登录后可以看到同一邮箱下的订单列表。
- 不登录不影响购买、支付和查看本次订单。

## 6. 后台管理

后台第一版直接使用 Medusa Admin。

### 6.1 使用 Medusa Admin 原生能力

Medusa Admin 负责：

- 商品管理。
- 分类管理。
- 规格管理。
- 价格管理。
- 订单管理。
- 客户管理。
- 管理员账号。
- 区域和支付方式基础配置。

### 6.2 新增后台页面

只新增 3 个页面。

#### 6.2.1 虚拟库存

路径建议：`/admin/credentials`

功能：

- 批次列表。
- 创建批次。
- 导入凭证。
- 查看库存数量。
- 查看凭证状态。
- 手动锁定凭证。
- 作废凭证。
- 查看凭证被哪个订单占用。

敏感凭证默认不直接显示，需要点击查看，并写入审计日志。

#### 6.2.2 交付管理

路径建议：`/admin/deliveries`

功能：

- 待交付订单。
- 已交付订单。
- 交付失败订单。
- 手动选择库存凭证。
- 一键交付。
- 补发。
- 填写交付备注。

当前实现中，库存凭证型商品在支付成功后会自动创建交付记录；手动交付用于人工开通、文件/API 尚未自动化的商品，或后台补发。

#### 6.2.3 支付通道

路径建议：`/admin/payment-channels`

功能：

- 查看通道列表。
- 启用 / 停用通道。
- 设置展示名称。
- 设置优先级。
- 设置最小金额。
- 设置最大金额。
- 设置支持币种。
- 查看通道健康状态。

密钥不在后台明文展示。密钥放在环境变量或 secret manager 中。

## 7. 核心业务流程

### 7.1 游客下单流程

```text
用户选择商品
  -> 加入购物车
  -> 进入结账页
  -> 填写邮箱
  -> 创建或复用游客 customer
  -> 将 customer/email 绑定到 cart
  -> 选择支付方式
  -> 按商品模板选择库存策略并预占库存
  -> 创建 payment_attempt
  -> 调用支付通道
  -> 用户完成支付
  -> webhook 确认支付
  -> 确保 Medusa order 存在并关联 payment_attempt
  -> 库存 reservation 转为 sold
  -> 通过 delivery handler 创建交付记录
  -> 通过 order access provider 发放或撤销访问令牌
  -> 用户查看交付内容
```

游客购买约束：

- Medusa 创建订单时 cart 需要关联 customer。
- 对未登录用户，系统用邮箱创建游客 customer。
- 游客 customer 不设置密码，`has_account=false`。
- 同一个邮箱可以有多个游客订单。
- 用户后续注册时，可以通过邮箱验证绑定历史订单。

### 7.2 游客订单访问流程

```text
支付成功
  -> 生成 order_access_token
  -> 浏览器 localStorage 保存 token
  -> 支付成功页展示订单详情入口
  -> 用户可直接查看本订单交付内容
```

订单找回：

```text
用户输入邮箱 + 订单号
  -> 系统校验订单归属
  -> 发送一次性验证码或魔法链接
  -> 验证成功后签发新的 order_access_token
  -> 用户查看订单和交付内容
```

安全规则：

- 不登录购买可以，但不能公开暴露交付内容。
- `order_access_token` 必须随机、不可猜、可过期、可撤销。
- 访问交付内容必须校验 token、订单归属和交付状态。
- 只凭订单号不能查看交付内容。
- 管理员补发或退款后，可以吊销旧 token。

### 7.3 虚拟库存状态流程

```text
in_stock
  -> reserved
  -> sold
  -> delivered
```

异常流程：

```text
reserved -> in_stock       支付超时释放
reserved -> locked         风控或人工锁定
sold -> delivered          正常交付
sold -> locked             售后争议
delivered -> replaced      已补发
delivered -> refunded      已退款
```

### 7.4 支付流程

```text
用户选择支付方式
  -> 系统按通道配置创建支付
  -> 支付通道返回支付 URL / 二维码 / 钱包地址
  -> 用户付款
  -> 支付通道发送 webhook
  -> 系统校验签名
  -> 写入 payment_attempt
  -> 更新订单支付状态
  -> 触发交付流程
```

### 7.5 支付失败与备用通道

第一版不做复杂自动路由，只做简单可控逻辑：

```text
首选通道创建失败
  -> 标记本次 payment_attempt 为 failed
  -> 前台提示当前通道不可用
  -> 用户选择其他支付方式
```

第二版再加入：

- 按金额自动推荐通道。
- 按健康状态隐藏异常通道。
- 按币种展示不同通道。
- 自动创建备用通道支付链接。

## 8. 支付设计

### 8.1 支付方式

支付模块按三类通道设计，第一版代码先实现 `manual`，真实聚合支付或加密货币 provider 在确认服务商和密钥后再接入。

| code | 用户看到的名称 | 类型 | 说明 |
| --- | --- | --- | --- |
| `aggregate_cn` | 微信 / 支付宝 / 银行卡 | 聚合支付 | 面向国内用户 |
| `crypto` | USDT / 加密货币 | 加密货币支付 | 备用通道或海外用户 |
| `manual` | 人工付款 | 人工确认 | 测试期、兜底、异常处理 |

当前实现状态：

- `payment_channels` 和 `payment_attempts` 已作为独立 Medusa 模块模型落库。
- Storefront 结账页从 `/store/payment-methods` 获取可用通道。
- `/store/carts/:cart_id/payments` 创建支付尝试，不要求用户登录。
- `manual` provider 通过统一 provider registry 接入。
- `/hooks/payment/manual` 可幂等标记支付成功。
- 真实 provider 接入时只新增 provider 实现和通道配置，不改前台结账主流程。

### 8.2 支付描述

传给支付网关的商品描述必须和实际交易不冲突，可以使用中性但真实的订单描述：

- `Digital goods order #10023`
- `Virtual product order #10023`
- `Online order #10023`

不要传递与实际交易无关的虚假名称。

### 8.3 Payment Provider 接口

所有支付通道实现统一接口。

```ts
export interface PaymentProvider {
  code: string

  createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>

  handleWebhook(input: WebhookInput): Promise<WebhookResult>

  queryPayment(input: QueryPaymentInput): Promise<QueryPaymentResult>

  refundPayment?(input: RefundPaymentInput): Promise<RefundPaymentResult>
}
```

### 8.4 创建支付输入

```ts
export interface CreatePaymentInput {
  orderId: string
  attemptId: string
  amount: number
  currency: string
  customerEmail?: string
  description: string
  successUrl: string
  failureUrl: string
  webhookUrl: string
  metadata?: Record<string, string>
}
```

### 8.5 创建支付输出

```ts
export interface CreatePaymentResult {
  providerOrderId: string
  status: "pending" | "failed"
  paymentUrl?: string
  qrCodeUrl?: string
  walletAddress?: string
  expiresAt?: string
  rawResponse?: unknown
}
```

### 8.6 Webhook 结果

```ts
export interface WebhookResult {
  providerOrderId: string
  orderId: string
  status: "paid" | "failed" | "expired" | "partial" | "refunded"
  paidAmount?: number
  paidCurrency?: string
  transactionId?: string
  rawPayload: unknown
}
```

### 8.7 支付通道路由

第一版规则：

```text
1. 查询 enabled = true 的通道。
2. 过滤未注册、禁用或健康状态不可用的 provider。
3. 按用户选择的 payment_method 过滤。
4. 按金额范围过滤。
5. 按币种过滤。
6. 创建 payment_attempt。
7. 调用 provider.createPayment。
8. 成功则返回支付信息。
9. 失败则记录错误，让用户选择其他通道。
```

## 9. 数据模型

### 9.1 使用 Medusa 原生模型

以下模型使用 Medusa 原生能力，不重复建设：

- product
- product_variant
- product_category
- cart
- order
- order_line_item
- customer
- payment_collection
- payment_session

### 9.2 自定义表

第一版新增 7 张表。

```text
account_batches
account_items
order_deliveries
after_sales
payment_channels
payment_attempts
order_access_tokens
audit_logs
```

### 9.3 account_batches

批次表，一批同类虚拟库存。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| name | text | 批次名称 |
| product_variant_id | text | 关联 Medusa variant |
| source_note | text | 来源备注 |
| total_count | integer | 总数量 |
| available_count | integer | 可售数量 |
| status | text | active / paused / archived |
| created_by | text | 创建人 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

### 9.4 account_items

单个库存凭证表，一条记录对应一个可出售的虚拟商品凭证。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| batch_id | text | 关联批次 |
| product_variant_id | text | 关联 Medusa variant |
| status | text | in_stock / reserved / sold / delivered / locked / refunded / replaced |
| display_label | text | 后台或用户侧可显示标签 |
| credential_encrypted | text | 加密后的凭证内容 |
| credential_version | integer | 凭证加密版本 |
| reserved_order_id | text | 预占订单 |
| sold_order_id | text | 售出订单 |
| reserved_at | timestamp | 预占时间 |
| sold_at | timestamp | 售出时间 |
| delivered_at | timestamp | 交付时间 |
| locked_reason | text | 锁定原因 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |
| deleted_at | timestamp | 软删除时间 |

### 9.5 order_deliveries

交付记录表。订单支付和商品交付分离。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| order_id | text | Medusa order id |
| order_item_id | text | Medusa order line item id |
| account_item_id | text | 交付的库存凭证 |
| delivery_status | text | pending / delivered / failed / replaced / refunded |
| delivery_payload_encrypted | text | 加密交付内容快照 |
| delivered_by | text | 操作人 |
| delivered_at | timestamp | 交付时间 |
| buyer_confirmed_at | timestamp | 用户确认时间 |
| delivery_note | text | 交付备注 |
| retry_count | integer | 重试次数 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

### 9.6 after_sales

售后记录表。第一版保持轻量。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| delivery_id | text | 交付记录 id |
| order_id | text | 订单 id，可为空 |
| cart_id | text | cart id |
| payment_attempt_id | text | 支付尝试 id |
| account_item_id | text | 凭证库存 id |
| customer_email | text | 游客邮箱 |
| reason | text | not_working / wrong_item / duplicate / refund / other |
| message | text | 用户问题描述 |
| status | text | open / processing / resolved / rejected |
| admin_note | text | 后台备注 |
| result | text | pending / replaced / refunded / rejected / resolved |
| handled_by | text | 处理人 |
| handled_at | timestamp | 处理时间 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

当前实现状态：

- `after_sales` 已由 `support-audit` 模块管理。
- Store API：`POST /store/deliveries/:access_token/after-sales`。
- Admin API：`GET /admin/after-sales`、`POST /admin/after-sales/:id`。
- Medusa Admin 可视化页面：`/app/after-sales`。
- 前台 `/orders` 的交付详情页已提供售后申请表单。

### 9.7 payment_channels

支付通道配置表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| code | text | 通道代码 |
| name | text | 后台名称 |
| display_name | text | 前台展示名 |
| type | text | aggregate_cn / crypto / manual |
| enabled | boolean | 是否启用 |
| priority | integer | 优先级，越小越优先 |
| min_amount | integer | 最小金额，按最小货币单位 |
| max_amount | integer | 最大金额，按最小货币单位 |
| currency | text | 币种 |
| provider_code | text | provider 实现代码 |
| config_json | jsonb | 非敏感配置 |
| health_status | text | healthy / degraded / down |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

敏感配置不进 `config_json`，例如 API key、secret、私钥。

当前实现状态：

- `payment_channels` 已由 `payment-router` 模块管理。
- Admin API：`GET /admin/payment-channels`、`POST /admin/payment-channels`、`POST /admin/payment-channels/:id`。
- 支付 channel 的 `type` 为开放字符串，新增 provider 不需要修改枚举。
- 前台只返回 provider 已注册且启用的 channel；禁用或缺失 provider 不会静默走 no-op。
- Medusa Admin 可视化页面：`/app/payments`。

### 9.8 payment_attempts

支付尝试记录表。一个订单可以有多次支付尝试。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| order_id | text | Medusa order id |
| payment_channel_id | text | 支付通道 id |
| provider_code | text | provider 代码 |
| provider_order_id | text | 三方订单号 |
| amount | integer | 金额，按最小货币单位 |
| currency | text | 币种 |
| status | text | pending / paid / failed / expired / partial / refunded |
| payment_url | text | 支付链接 |
| qr_code_url | text | 二维码 |
| expires_at | timestamp | 过期时间 |
| request_payload | jsonb | 请求摘要 |
| response_payload | jsonb | 响应摘要 |
| callback_payload | jsonb | 回调摘要 |
| error_message | text | 错误信息 |
| paid_at | timestamp | 支付成功时间 |
| created_at | timestamp | 创建时间 |
| updated_at | timestamp | 更新时间 |

当前实现状态：

- `payment_attempts` 已由 `payment-router` 模块管理。
- Admin API：`GET /admin/payment-attempts`、`POST /admin/payments/manual/mark-paid`。
- webhook 支持 `/hooks/payment/:provider_code` 通用入口；`/hooks/payment/manual` 作为人工支付兼容入口保留。
- `(provider_code, provider_order_id)` 有唯一约束，重复 webhook 走幂等更新。
- Medusa Admin 可视化页面：`/app/payments`。

### 9.9 order_access_tokens

游客订单访问令牌表。不登录购买时，用它保护订单详情和交付内容。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| order_id | text | Medusa order id |
| customer_email | text | 下单邮箱 |
| token_hash | text | 访问令牌哈希，不保存明文 token |
| purpose | text | view_order / magic_link / claim_order |
| expires_at | timestamp | 过期时间 |
| used_at | timestamp | 一次性令牌使用时间 |
| revoked_at | timestamp | 吊销时间 |
| created_at | timestamp | 创建时间 |

规则：

- 明文 token 只在创建时返回给前台或邮件链接。
- 数据库只保存 token hash。
- 查看交付内容时校验 token hash。
- magic link / 验证码类 token 使用后应标记 used。
- 订单退款、争议或风控时可以吊销 token。

### 9.10 audit_logs

审计日志表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | text | 主键 |
| actor_id | text | 操作人 id |
| actor_type | text | admin / customer / guest / system / webhook |
| action | text | 操作类型 |
| entity_type | text | 资源类型 |
| entity_id | text | 资源 id |
| risk_level | text | low / medium / high |
| ip_address | text | IP |
| user_agent | text | UA |
| metadata_json | jsonb | 附加信息 |
| created_at | timestamp | 创建时间 |

必须写审计的行为：

- 查看凭证明文。
- 导出凭证。
- 手动改库存状态。
- 手动确认支付。
- 手动退款。
- 手动补发。
- 修改支付通道配置。

当前实现已覆盖：

- `payment_attempt.mark_paid`
- `payment_attempt.webhook_paid`
- `credential.reveal_for_delivery`
- `delivery.created`
- `delivery.viewed`
- `delivery.confirmed`
- `after_sale.created`
- `after_sale.updated`

Admin API：`GET /admin/audit-logs`。

Medusa Admin 可视化页面：`/app/audit-logs`。

## 10. Medusa 模块设计

当前第一版自定义模块按业务边界拆分为支付路由、凭证库存、数字交付、游客订单访问、售后审计等模块；主流程通过平台能力契约组合它们。

### 10.1 credential-inventory

负责：

- 批次管理。
- 凭证导入。
- 凭证加密保存。
- 凭证预占。
- 凭证售出。
- 凭证交付标记。
- 凭证释放。

核心方法：

```ts
createCredentialBatch(input): Promise<{ batch; items }>
reserveCredentials(input: { productVariantId; quantity; reservationKey }): Promise<AccountItem[]>
releaseReservation(input: { reservationKey: string }): Promise<AccountItem[]>
releaseExpiredReservations(): Promise<AccountItem[]>
markReservationSold(input: { reservationKey; orderId? }): Promise<AccountItem[]>
```

当前实现状态：

- `credential-inventory` 已作为独立 Medusa 模块注册。
- `account_batches` / `account_items` 已落库。
- `credential_blob` 使用 AES-256-GCM 加密，密钥来自 `CREDENTIAL_ENCRYPTION_KEY` 环境变量。
- Admin API 可导入批次、查询脱敏库存、预占、售出和释放。
- Medusa Admin 可视化页面：`/app/credentials`。
- 凭证导入页面支持批量粘贴：一行一个卡密、`账号----密码`、`账号,密码`、`账号|密码`、`账号:密码`、JSON object line、JSON array。
- `credential-inventory` 注册为 `inventory-handler` 和 `delivery-handler`，主流程只调用平台能力。
- Store checkout 创建 payment attempt 时会按 product template 的 `inventoryHandlerCode` 决定是否预占凭证。
- 支付成功 finalization 会把对应预占凭证转为 `sold`，并通过交付 handler 创建交付记录；重复 webhook 幂等。
- 每分钟 scheduled job 会释放过期 `reserved` 凭证。

### 10.2 digital-delivery

负责：

- 创建交付记录。
- 获取待交付订单。
- 自动交付。
- 手动交付。
- 补发。
- 用户查看交付内容。

核心方法：

```ts
createManualDelivery(input): Promise<{ delivery; accessToken | null }>
listDeliveriesSafe(input): Promise<OrderDelivery[]>
retrieveDeliveryByAccessToken(accessToken): Promise<{ delivery; payload }>
confirmDelivery(accessToken): Promise<OrderDelivery>
```

当前实现状态：

- `digital-delivery` 已作为独立 Medusa 模块注册。
- `order_deliveries` 已落库，交付内容快照加密保存。
- Admin API 可查看待交付项、创建手动交付、查询交付记录。
- Medusa Admin 可视化页面：`/app/deliveries`。
- 库存凭证型商品支付成功后会自动生成加密交付快照，并把 `account_item.delivered_at` 标记为已交付。
- 手动交付支持 `account_item_id` 或直接传入 `delivery_payload`，适合人工开通、文件/API 交付和补发。
- Store API 通过 delivery access token 查询交付内容，数据库只保存 token hash。
- Store API 也支持通过 order access token 查询订单及该订单下的全部交付 payload。
- 用户可在 `/orders` 输入 order access token 或 legacy delivery access token 查看交付内容并确认收货。
- 重复交付不会覆盖原交付记录；补发会在后续售后阶段作为新记录扩展。

### 10.3 payment-router

负责：

- 支付通道配置。
- 创建支付尝试。
- 调用具体支付 provider。
- 处理 webhook。
- 查询支付结果。
- 更新 payment_attempt 状态。
- 通知订单流程。

核心方法：

```ts
createPaymentAttempt(input: CreatePaymentAttemptInput): Promise<PaymentAttempt>
createPayment(input: CreatePaymentInput): Promise<CreatePaymentResult>
handleWebhook(input: HandleWebhookInput): Promise<void>
queryPayment(input: QueryPaymentInput): Promise<QueryPaymentResult>
```

## 11. 安全要求

### 11.1 凭证加密

虚拟商品凭证必须加密保存。

要求：

- 不把账号密码、卡密、兑换码长期明文保存。
- 使用服务端加密。
- 密钥不放数据库。
- 密钥通过环境变量、secret manager 或 KMS 管理。
- 交付时只在必要时间解密。
- 查看明文写入审计日志。

### 11.2 用户密码

购买不要求用户密码。

如果用户选择注册或登录，用户密码使用 Medusa/Auth 原生机制处理，不自行保存明文或可逆加密密码。

游客订单访问令牌不是用户密码：

- 明文令牌只展示或发送一次。
- 数据库只保存哈希。
- 令牌可以过期和吊销。
- 令牌只能访问对应订单。

### 11.3 Webhook 安全

所有支付 webhook 必须：

- 校验签名。
- 校验金额。
- 校验币种。
- 校验订单号。
- 幂等处理。
- 记录原始回调摘要。
- 不因重复 webhook 重复发货。

### 11.4 幂等要求

以下操作必须幂等：

- 支付 webhook。
- 支付查询补偿。
- 库存预占。
- 标记支付成功。
- 创建交付记录。
- 自动交付。

### 11.5 后台权限

第一版可以用简单角色：

- owner：所有权限。
- operator：订单、交付、售后。
- inventory：库存导入、库存查看。
- readonly：只读。

查看凭证明文、导出凭证、手动确认支付必须限制权限。

## 12. Redis 队列任务

第一版需要 4 类后台任务。

### 12.1 支付轮询

用途：webhook 丢失时补偿。

```text
pending payment_attempt
  -> 到期前定时 queryPayment
  -> paid 则更新订单
  -> expired 则标记失败
```

### 12.2 库存释放

用途：支付超时后释放 reserved 凭证。

```text
订单超过支付有效期
  -> payment_attempt expired
  -> account_item reserved -> in_stock
```

### 12.3 自动交付

用途：支付成功后自动交付库存凭证。

```text
订单 paid
  -> 找到 sold account_item
  -> 创建 order_delivery
  -> 写入加密交付快照
  -> 标记 delivered
```

当前库存凭证型商品默认自动交付；非库存或人工开通商品通过 `manual` delivery handler 由后台创建交付记录。

### 12.4 webhook 重试

用途：内部处理失败时重试。

```text
webhook received
  -> verify success
  -> internal process failed
  -> enqueue retry
```

## 13. API 设计

### 13.1 前台 API

#### 游客设置邮箱

```http
POST /store/carts/:cart_id/customer-email
```

请求：

```json
{
  "email": "buyer@example.com"
}
```

行为：

- 创建或复用游客 customer。
- 将 email/customer 绑定到 cart。
- 不创建登录账号。
- 不要求密码。

#### 获取可用支付方式

```http
GET /store/payment-methods?cart_id=xxx
```

返回：

```json
{
  "methods": [
    {
      "code": "aggregate_cn",
      "display_name": "微信 / 支付宝",
      "enabled": true
    },
    {
      "code": "crypto",
      "display_name": "USDT / 加密货币",
      "enabled": true
    },
    {
      "code": "manual",
      "display_name": "人工付款",
      "enabled": true
    }
  ]
}
```

#### 创建支付

```http
POST /store/carts/:cart_id/payments
```

请求：

```json
{
  "payment_method": "manual"
}
```

返回：

```json
{
  "attempt": {
    "id": "payatt_123",
    "status": "pending",
    "provider_order_id": "manual_xxx"
  },
  "instructions": {
    "title": "Manual payment",
    "body": "..."
  },
  "claim_token": "claim_plain_returned_once"
}
```

#### 查询支付状态

```http
GET /store/payment-attempts/:attempt_id
```

返回：

```json
{
  "attempt_id": "payatt_123",
  "status": "paid"
}
```

#### 获取订单交付内容

```http
GET /store/deliveries/:access_token
```

返回：

```json
{
  "delivery": {
    "id": "del_123",
    "delivery_status": "delivered",
    "delivered_at": "2026-05-08T12:10:00.000Z"
  },
  "payload": {
    "code": "交付内容"
  }
}
```

#### 获取游客订单和全部交付内容

```http
GET /store/order-access/:access_token
```

返回：

```json
{
  "order": {
    "id": "order_123",
    "status": "completed"
  },
  "deliveries": [
    {
      "delivery": {
        "id": "del_123",
        "delivery_status": "delivered"
      },
      "payload": {
        "code": "交付内容"
      }
    }
  ]
}
```

#### 找回游客订单

```http
POST /store/orders/recover
```

请求：

```json
{
  "email": "buyer@example.com",
  "order_id": "order_123"
}
```

行为：

- 校验邮箱和订单归属。
- 发送一次性验证码或魔法链接。
- 不直接返回交付内容。

#### 验证订单找回

```http
POST /store/orders/recover/verify
```

请求：

```json
{
  "order_id": "order_123",
  "code": "123456"
}
```

返回：

```json
{
  "order_id": "order_123",
  "access_token": "plain-token-returned-once"
}
```

### 13.2 后台 API

#### 导入凭证

```http
POST /admin/credential-inventory/batches
```

请求：

```json
{
  "items": [
    {
      "display_label": "Account #001",
      "credential": "username:xxx password:yyy"
    }
  ]
}
```

#### 查询脱敏库存

```http
GET /admin/credential-inventory/items?product_variant_id=variant_xxx&status=in_stock
```

#### 预占、售出、释放

```http
POST /admin/credential-inventory/reservations
POST /admin/credential-inventory/reservations/:reservation_key/sell
POST /admin/credential-inventory/reservations/:reservation_key/release
```

第一版不对外暴露“查看凭证明文”接口；后续在 M4/M5 结合交付记录和审计日志后再提供受控解密。

要求：

- 校验管理员权限。
- 写入审计日志。
- 返回解密内容。

#### 手动交付

```http
POST /admin/digital-delivery/deliveries
```

请求：

```json
{
  "account_item_id": "acctitem_123",
  "delivery_payload": {
    "code": "manual delivery content"
  },
  "delivery_note": "已交付"
}
```

`account_item_id` 和 `delivery_payload` 至少提供一个；提供 `account_item_id` 时由凭证交付 handler 解密并审计，提供 `delivery_payload` 时直接生成手动交付快照。

#### 待交付列表

```http
GET /admin/digital-delivery/pending
```

#### 手动确认支付

```http
POST /admin/payment-attempts/:id/mark-paid
```

要求：

- 只允许 owner 或 operator。
- 必须填写备注。
- 写入审计日志。

## 14. 订单状态映射

Medusa 订单状态和业务交付状态分开。

| 业务状态 | 支付状态 | 交付状态 | 说明 |
| --- | --- | --- | --- |
| 待支付 | pending | none | 已创建订单，未支付 |
| 已支付待处理 | paid | pending | 支付成功，等待人工或外部交付 |
| 已交付 | paid | delivered | 已写入交付记录；库存凭证型商品支付成功后默认进入此状态 |
| 已完成 | paid | delivered + confirmed | 用户确认或超过自动确认时间 |
| 已关闭 | failed / expired | none | 支付失败或超时 |
| 售后中 | paid/refunded | disputed | 有售后记录 |
| 已退款 | refunded | refunded | 已退款 |

## 15. 项目目录建议

```text
store/
  apps/
    backend/                 Medusa 后端
    storefront/              Next.js 前台
  docs/
    independent-store-spec.md
  docker-compose.yml
  README.md
```

如果第一版想更省事，也可以先用 Medusa starter 的目录结构，再逐步整理成 monorepo。

## 16. 环境变量

完整说明见 [Environment Variables](ops/environment.md)。

核心示例：

```env
DATABASE_URL=postgres://...
REDIS_URL=redis://...
JWT_SECRET=...
COOKIE_SECRET=...

CREDENTIAL_ENCRYPTION_KEY=...
DELIVERY_ENCRYPTION_KEY=...

PAYMENT_AGGREGATE_API_KEY=...
PAYMENT_AGGREGATE_SECRET=...

PAYMENT_CRYPTO_API_KEY=...
PAYMENT_CRYPTO_SECRET=...

NEXT_PUBLIC_MEDUSA_BACKEND_URL=http://localhost:9000
```

生产环境密钥不要提交到仓库。

## 16.1 运维与验收

当前实现状态：

- 部署说明：[Deployment Guide](ops/deployment.md)。
- 备份恢复说明：[Backup And Restore](ops/backup-restore.md)。
- 本地验收说明：[Local Acceptance](ops/local-acceptance.md)。
- 后端健康检查：`GET /health`。
- 前台健康检查：`GET /api/health`。
- 本地验收命令：`pnpm acceptance`。
- Live 健康检查命令：`pnpm health`。
- 数据库备份命令：`pnpm backup:db`。

## 17. 开发里程碑

### 17.1 M0：项目基础

- 初始化 Medusa 后端。
- 初始化 Next.js 前台。
- 配置 PostgreSQL。
- 配置 Redis。
- 本地 Docker Compose。
- Admin 能登录。

验收：

- 后端可启动。
- 前台可启动。
- Admin 可访问。
- 数据库迁移正常。

### 17.2 M1：商品与购买路径

- 商品展示。
- 分类页。
- 商品详情。
- 购物车。
- 结账页。
- 游客订单查询页。
- 游客订单详情页。

验收：

- 能从前台创建购物车。
- 不登录也能填写邮箱并保存游客结账信息。
- 能进入支付方式选择入口。
- 能进入订单查询入口。
- 真正创建订单和后台订单记录在 M2 支付接入后完成。

### 17.3 M2：支付

- payment_channels。
- payment_attempts。
- manual provider。
- crypto 或聚合支付 provider。
- webhook 接口。
- 支付状态查询。

验收：

- 用户能选择支付方式。
- 支付成功能更新订单。
- 重复 webhook 不会重复处理。
- 支付失败能选择其他通道。

### 17.4 M3：虚拟库存

- account_batches。
- account_items。
- 凭证导入。
- 凭证加密保存。
- 库存状态流转。
- 支付创建时预占库存。
- 支付成功时转为售出。
- 过期预占自动释放。

验收：

- 后台能导入凭证。
- 支付成功后能占用凭证。
- 凭证明文不出现在 API 响应或普通库存查询里。
- 支付超时能释放凭证。
- 凭证明文查看有审计日志。

### 17.5 M4：交付

- order_deliveries。
- 后台待交付列表。
- 手动交付。
- 用户订单详情查看交付内容。
- 用户确认收货。

验收：

- 系统能自动交付库存凭证型订单，后台能手动交付或补发其他订单。
- 用户能查看已交付内容。
- 补发不会覆盖原交付记录。

### 17.6 M5：售后与审计

- after_sales。
- audit_logs。
- 售后备注。
- 补发/退款记录。
- 用户交付页售后入口。
- Admin 售后处理 API。
- 敏感交付查看和后台操作审计。

验收：

- 用户能提交售后。
- 后台能处理售后。
- 关键后台操作有审计记录。

## 18. 第一版验收标准

第一版完成时，必须满足：

- 前台能完整购买一个虚拟商品。
- 用户不登录也能完成购买。
- 至少有一个真实支付通道或人工支付通道可用。
- 支付成功后订单状态正确。
- 虚拟库存不会被重复卖出。
- 凭证内容不会明文长期保存。
- 后台能交付订单。
- 用户能查看自己的交付内容。
- 游客查看订单和交付内容必须通过订单访问令牌或邮箱验证。
- 重复 webhook 不会重复发货。
- 后台查看敏感凭证会写审计日志。
- 通道故障时用户能改选备用通道。

## 19. 后续扩展方向

第二版可以考虑：

- 自动支付通道健康检查。
- 按金额自动推荐支付通道。
- 更多交付 handler，例如文件下载、外部 API 开通和供应商自动补发。
- 更多支付 provider。
- 批量导入 CSV。
- 凭证有效性检测。
- 更细后台权限。
- KMS 或 Vault 管理密钥。
- 对账报表。
- 销售统计。
- 售后工单。
- 优惠券。
- 邮件通知。

## 20. 最终方案摘要

本项目第一版采用：

- Medusa 管商品、订单、客户和 Admin。
- Next.js 做独立站前台。
- PostgreSQL 存业务数据。
- Redis 做队列和临时锁。
- 自定义模块补虚拟库存、交付和支付通道。
- 支付方式提供微信/支付宝聚合、加密货币、人工付款三类。
- 支付插件化只保留统一 Provider 接口，不做复杂支付中台。
- 凭证加密保存，交付和敏感查看必须审计。

这套方案足够小，可以较快落地；同时在支付、库存、交付三处留出了长期扩展接口，后续能持续迭代而不需要推倒重做。
