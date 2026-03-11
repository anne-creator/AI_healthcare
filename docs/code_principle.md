# Frontend Architecture Guide

## How to Use This Document

You are helping me build a frontend project based on Next.js, shadcn/ui, and Tailwind CSS. This document defines my component architecture standards. When creating any UI component, first identify which Level (0 through 5) it belongs to, then follow the corresponding principles. Do not mix responsibilities across levels.

---

## 核心架构分层 (Layered Architecture)

根据组件封装、Block 分层、页面纯组装的原则，以下是完整的架构计划。

### Level 0: 设计令牌 (Design Tokens)

目录 `styles/` 或在 `tailwind.config.js` 的 `theme.extend` 中集中管理。这是所有层级的基础，任何"魔法数字"都不应该出现在组件代码中，全部抽象为 token。

包括以下内容：
- 颜色系统（含 dark/light theme variants，使用 CSS variables 如 `--background`, `--accent`）
- 排版比例（font sizes, line heights, font weights）
- 间距系统（包括组件内间距和 section gaps）
- 阴影（box shadows）
- 圆角（border radius）
- 动画时长和缓动曲线（transition durations, easing functions）

Theme 切换通过 CSS variables 实现，在 `:root` 定义默认主题，在 `[data-theme="light"]` 或 `.light` 中覆盖变量值。

**Section Spacing Tokens 定义示例：**

在 globals.css 中：
```css
:root {
  --section-gap-sm: 3rem;    /* 48px */
  --section-gap-md: 5rem;    /* 80px */
  --section-gap-lg: 8rem;    /* 128px */
  --section-gap-xl: 12rem;   /* 192px */
}
```

或在 tailwind.config.js 中扩展：
```js
theme: {
  extend: {
    spacing: {
      'section-sm': '3rem',
      'section-md': '5rem',
      'section-lg': '8rem',
      'section-xl': '12rem',
    }
  }
}
```

### Level 1: 基础原子 (Base Primitives)

来自 shadcn/ui 的底层组件 (components/ui/button.tsx)。我们会在这里进行深度定制，修改其默认样式以匹配 Level 0 的 Design Tokens。

**可访问性要求 (Accessibility Requirements):**

所有 Base Primitives 必须遵守：
- Icon-only buttons 必须有 `aria-label`（屏幕阅读器需要知道按钮用途）
- 表单输入必须关联 `<label>`（使用 `htmlFor` 或包裹方式）
- 交互元素需要 `focus-visible` 样式（禁止 `outline-none` 而不提供替代）
- 使用语义化 HTML (`<button>`, `<nav>`, `<main>`, `<section>`) 而非 `<div>` + onClick

```tsx
// ❌ 错误
<div onClick={handleClick}><TrashIcon /></div>

// ✅ 正确
<button aria-label="删除" onClick={handleClick} className="focus-visible:ring-2">
  <TrashIcon aria-hidden="true" />
</button>
```

### Level 2: 动画封装 (Animation Wrappers)

专门的目录 components/animations/。例如：`<HoverGlow>` (鼠标光晕), `<FadeIn>` (渐入), `<Magnetic>` (磁吸效果)。目的：未来任何组件包裹上这个 Wrapper 就能获得"魔法效果"。

**动画无障碍要求 (Animation Accessibility Requirements):**

- 必须支持 `prefers-reduced-motion`（有些用户看动画会不适）
- 只动画 `transform` 和 `opacity`（GPU 加速，compositor-friendly）
- 禁止使用 `transition: all`，必须明确列出属性

```css
/* 在 Level 0 globals.css 中定义 reduced motion 支持 */
@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

```tsx
// ❌ 错误
<motion.div style={{ transition: 'all 0.3s' }} />

// ✅ 正确
<motion.div 
  style={{ transition: 'transform 0.3s, opacity 0.3s' }}
  // Framer Motion 自动处理 reduced motion
/>
```

### Level 2.5: 复合组件 (Compound Components)

专门的目录 components/compound/。例如：`<Tabs>`, `<Accordion>`, `<Modal>`, `<Dropdown>`, `<Tooltip>`, `<ThemeToggle>`。这些组件由多个 Base Primitives 组合而成，管理自己的内部 UI 状态（比如哪个 tab 是激活的，dropdown 是否展开，当前是什么 theme）。关键特性：它们是内容无关的，不绑定任何业务数据，可以在任何项目中复用。可以理解为"小型的、通用的 Block"，但没有业务逻辑。

### Level 3: 业务组件 (Custom Components)

这是你的"私有库"。例如：DSButton (可能组合了动画和 Base Button)，DSCard (可能包裹了 HoverGlow 和 Compound Components 如 Accordion)。这一层负责将品牌设计语言应用到组件上。

**SectionSpacer 组件定义（放在 components/custom/section-spacer.tsx）：**

```tsx
interface SectionSpacerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
}

export function SectionSpacer({ size = 'md' }: SectionSpacerProps) {
  const sizeClasses = {
    sm: 'h-section-sm',   // 引用 Level 0 的 token
    md: 'h-section-md',
    lg: 'h-section-lg',
    xl: 'h-section-xl',
  }
  return <div className={sizeClasses[size]} aria-hidden="true" />
}
```

这个组件确保 Page 层不需要写任何样式代码，只需要放置 `<SectionSpacer size="lg" />` 即可。

### Level 4: 区块 (Blocks)

目录 components/blocks/。这是页面的主要构成部分。例如：HeroSection, Footer, PowerList, LinkGarden。原则：Block 内部处理布局和组件组合。Block 作为"指挥官"，负责编排子组件的动画时机（如 staggerChildren）。

**Block 自带间距处理：**

如果某个 Block 永远需要特定的上下间距（比如 HeroSection 下方总是需要较大的呼吸空间），这个间距应该定义在 Block 内部，使用 Level 0 的 tokens：

```tsx
export function HeroSection() {
  return (
    <section className="mb-section-lg">  {/* 引用 token，不写魔法数字 */}
      {/* Block 内容 */}
    </section>
  )
}
```

### Level 5: 页面 (Pages)

app/page.tsx。原则：绝对不写样式配置。只负责把 Block 堆叠起来，以及处理数据获取（Server Components）和状态传递。

**使用 SectionSpacer 处理组合间距：**

当两个特定 Block 组合时需要特殊间距（不属于任何一个 Block 的固有间距），在 Page 中使用 SectionSpacer：

```tsx
export default function HomePage() {
  return (
    <>
      <HeroSection />
      <SectionSpacer size="xl" />  {/* 特殊的大间距 */}
      <PowerList items={projects} />
      <SectionSpacer size="md" />
      <AboutSection />
      <Footer />
    </>
  )
}
```

Page 层只负责"放置"组件，不直接写 className 或 style。

---

## 动画层级定义 (Animation Layer Definitions)

动画不仅存在于组件内部，也存在于组件之间。以下是每个层级的动画职责。

### Level 2: Component Level Animations (微交互)

例子：鼠标悬停按钮变亮、点击卡片下沉。处理方式：封装在 Animation Wrappers 或 Custom Components 内部。这些是"装饰性动画"，任何元素包裹上就能获得效果。

### Level 2.5: Compound Component Level Animations (状态过渡)

例子：Accordion 展开/收起时的高度过渡动画，Modal 弹出时的 scale + fade 效果，Dropdown 菜单滑入滑出，Tabs 切换时内容区域的 crossfade，Tooltip 的延迟显示和淡入，ThemeToggle 切换时的图标旋转或颜色过渡。

处理方式：这些动画与组件的内部状态紧密绑定（isOpen, activeTab, isVisible, currentTheme）。动画逻辑应该封装在 Compound Component 内部，因为它属于组件"如何工作"的一部分，而不是外部装饰。可以使用 Framer Motion 的 `AnimatePresence` 处理条件渲染的进场/退场，或者使用 CSS transitions 处理简单的状态变化。

关键区别：Level 2 的 Animation Wrappers 是"加上去的效果"（任何东西包裹一下就有），而 Level 2.5 的动画是"内在的行为"（没有这个动画，组件的状态变化会显得生硬和不完整）。

### Level 4: Block Level Animations (编排)

例子：PowerList 需要"滚动时卡片依次浮现"效果。这不是单个卡片的事，而是列表（Block）在指挥卡片。处理方式：在 Block 中使用 Framer Motion 的 staggerChildren（交错动画）。Block 作为"指挥官"，控制子组件的进场时机。

### Level 5: Page/Layout Level Animations (转场)

例子：页面切换时的淡入淡出，或者滚动页面时背景模糊。处理方式：在 app/template.tsx (Next.js 专用于页面转场的组件) 或者特定的 Layout Block 中处理。

---

## 架构原则总结 (Architecture Principles)

这是构建可扩展 Design System 的黄金标准（Atomic Design 的变体）。核心优势是关注点分离：

- Tokens 关注"设计系统的基础值是什么"
- Base 关注"我是什么样子"
- Animation Wrappers 关注"我如何增添动效装饰"
- Compound 关注"我如何管理多元素的交互状态和内在过渡"
- Custom 关注"我如何体现品牌"
- Block 关注"我包含什么内容，如何编排子元素"
- Page 关注"我在哪里显示，数据从哪来"

---

## 文件夹结构参考 (Folder Structure Reference)

```
styles/
├── globals.css            # Level 0: CSS variables, theme definitions

components/
├── ui/                    # Level 1: Base Primitives (shadcn)
├── animations/            # Level 2: Animation Wrappers
├── compound/              # Level 2.5: Compound Components
├── custom/                # Level 3: Custom Components (including SectionSpacer)
└── blocks/                # Level 4: Blocks

providers/                 # 可复用业务模块: Global State Providers
├── auth-provider.tsx      # Auth 模块 (全站共享)
└── index.ts               # 统一导出

hooks/                     # 可复用业务模块: 独立 Hooks
├── use-payment.ts         # Payment 模块 (单页面使用)
└── index.ts               # 统一导出

app/
├── layout.tsx             # Global layout, 引入 Providers
├── template.tsx           # Route transition animations
└── page.tsx               # Level 5: Pure assembly
```

---

## Hard Rules

- Level 0 (Tokens): 任何颜色、间距、字体大小等"魔法数字"必须在这里定义，组件中只能引用 token
- Level 1 (Base): 只修改视觉样式以匹配 tokens，不添加业务逻辑；Icon-only buttons 必须有 aria-label；交互元素必须有 focus-visible 样式
- Level 2 (Animation Wrappers): 必须接受 children 并应用效果，不修改 child 的逻辑；必须支持 prefers-reduced-motion；只动画 transform/opacity；禁止 transition: all
- Level 2.5 (Compound): 不能 fetch 数据，不能包含业务逻辑，只管理 UI 状态
- Level 3 (Custom): 应用品牌设计语言，可以组合 Level 1, 2, 2.5 的组件
- Level 4 (Blocks): 是唯一负责编排 staggered animations 的层级，处理自己的布局和 section 内间距
- Level 5 (Pages): 绝对不写 className 或 inline styles，只负责组装 Blocks 和 SectionSpacer，以及数据获取

---

## Before Submitting Code, Verify

**Architecture:**
- [ ] Component is in the correct folder for its level
- [ ] No level is skipping another (e.g., Page directly using Base Primitive without going through Block)
- [ ] Animations are handled at the appropriate level
- [ ] Compound components have no business data dependencies
- [ ] All magic numbers are replaced with Design Tokens
- [ ] Section spacing uses tokens from Level 0, either via Block's built-in margin or via SectionSpacer in Page

**Accessibility:**
- [ ] Icon-only buttons have `aria-label`
- [ ] Form inputs have associated `<label>`
- [ ] Interactive elements have `focus-visible` styles (no bare `outline-none`)
- [ ] Using semantic HTML (`<button>`, `<nav>`, `<main>`) instead of `<div>` + onClick

**Animation:**
- [ ] Animations respect `prefers-reduced-motion`
- [ ] Only animating `transform` and `opacity` (no `width`, `height`, `margin`)
- [ ] No `transition: all` - properties are explicitly listed

---

# Part 2: State & Data Management

## 本节作用

本节定义 L0-L5 架构下的**状态管理和数据获取**规则。这不是独立的系统，而是与上面的 UI 架构紧密配合。

**详细实现模式请参考 Skills：**
- `vercel-composition-patterns` → Context 设计、Provider 模式、组合模式
- `vercel-react-best-practices` → 数据获取、性能优化、re-render 控制

---

## 状态层级映射 (State Layer Mapping)

状态不全放在 Page 层。根据作用范围分三层：

| 状态层 | 位置 | 适用场景 | 示例 |
|-------|------|---------|------|
| **Global** | `layout.tsx` + `providers/` | 跨页面共享 | Theme, Auth, Cart |
| **Page** | `page.tsx` | 当前页面专属 | 表单数据, 页面 filter |
| **Component** | L2.5 Compound | 组件内部 UI 状态 | Accordion 展开, Modal 打开 |

---

## L0-L5 的状态职责

| 层级 | 可以做 | 不能做 |
|-----|-------|-------|
| Layout | 定义 Global Providers (ThemeProvider, AuthProvider) | - |
| L5 Page | Server Component fetch; 定义 Page State; CONSUME global context | - |
| L4 Block | **CONSUME** context, 调用 actions | **MANAGE** 状态逻辑 |
| L3 Custom | **CONSUME** context, 调用 actions | **MANAGE** 状态逻辑 |
| L2.5 Compound | **MANAGE** 内部 UI 状态 (isOpen, activeTab) | 访问业务数据 |
| L2 Animation | 纯展示包装 | 任何状态 |
| L1 Base | 纯展示，接收 props | 任何状态 |
| L0 Tokens | 静态值 | - |

**关键区分：CONSUME vs MANAGE**
- **CONSUME** = 读取 context，调用 `actions.toggle()`（✅ L1-L4 可以做）
- **MANAGE** = 定义状态逻辑，写 `useState`, `useReducer`（❌ 只有 Layout/Page/L2.5 可以做）

---

## 示例：Block 内按钮控制全局状态

```tsx
// providers/theme-provider.tsx (Global State 定义在这里)
'use client'
const ThemeContext = createContext<{
  state: { theme: 'light' | 'dark' }
  actions: { toggle: () => void }
} | null>(null)

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark')
  const actions = useMemo(() => ({
    toggle: () => setTheme(prev => prev === 'dark' ? 'light' : 'dark')
  }), [])
  return <ThemeContext value={{ state: { theme }, actions }}>{children}</ThemeContext>
}

export const useTheme = () => use(ThemeContext)
```

```tsx
// app/layout.tsx (Provider 放在 Layout)
export default function RootLayout({ children }) {
  return (
    <html><body>
      <ThemeProvider>{children}</ThemeProvider>
    </body></html>
  )
}
```

```tsx
// components/blocks/header.tsx (L4 Block 只 CONSUME)
'use client'
export function Header() {
  const { state, actions } = useTheme() // ✅ CONSUME
  return (
    <header>
      <button onClick={actions.toggle}> {/* 调用 action，不定义逻辑 */}
        {state.theme === 'dark' ? '☀️' : '🌙'}
      </button>
    </header>
  )
}
```

---

## 可复用业务模块 (Reusable Business Modules)

### 目标

将 Auth、Payment 等业务功能封装成**独立、可复用的模块**，可以轻松复制到其他项目中使用，就像复用 Button 组件一样。

### 何时用 Provider vs 独立 Hook

| 类型 | 何时使用 | 目录 | 示例 |
|-----|---------|------|------|
| **Provider** | 状态需要**全站共享**（多个页面/组件都要读取） | `providers/` | Auth（Header、Profile、Settings 都需要知道用户信息） |
| **独立 Hook** | 状态**只在调用处**使用（不需要全站知道） | `hooks/` | Payment（只在结账页使用） |

### 当前模块清单

| 模块 | 类型 | 文件 | 说明 |
|-----|------|------|------|
| Auth | Provider | `providers/auth-provider.tsx` | 登录、登出、用户信息（全站共享） |
| Payment | Hook | `hooks/use-payment.ts` | 支付处理（单页面使用） |

### 封装设计原则

**1. 自包含 (Self-contained)**
- 模块内部包含所有需要的类型定义、API 调用、状态管理
- 外部只需要 import 一个文件即可使用

**2. 配置化 (Configurable)**
- 通过参数/环境变量配置 API endpoints、keys 等
- 不硬编码项目特定的值

**3. 接口统一 (Consistent Interface)**
- Provider 模式使用 `{ state, actions, meta? }` 接口
- Hook 模式返回 `{ data, actions, isLoading, error }` 接口

### Provider 模块结构示例 (Auth)

```
providers/
└── auth-provider.tsx
```

```tsx
// providers/auth-provider.tsx
'use client'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  refreshToken: () => Promise<void>
}

interface AuthContextValue {
  state: AuthState
  actions: AuthActions
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  
  const actions: AuthActions = useMemo(() => ({
    login: async (email, password) => {
      const user = await authAPI.login(email, password)
      setUser(user)
    },
    logout: async () => {
      await authAPI.logout()
      setUser(null)
    },
    refreshToken: async () => { /* ... */ }
  }), [])
  
  const state: AuthState = {
    user,
    isAuthenticated: !!user
  }
  
  return (
    <AuthContext value={{ state, actions }}>
      {children}
    </AuthContext>
  )
}

export function useAuth() {
  const context = use(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
```

### 独立 Hook 模块结构示例 (Payment)

```
hooks/
└── use-payment.ts
```

```tsx
// hooks/use-payment.ts
'use client'

interface PaymentActions {
  processPayment: (amount: number, cardToken: string) => Promise<PaymentResult>
  validateCard: (cardNumber: string) => ValidationResult
}

interface UsePaymentReturn {
  actions: PaymentActions
  isProcessing: boolean
  error: Error | null
}

export function usePayment(): UsePaymentReturn {
  const [isProcessing, setIsProcessing] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  
  const actions: PaymentActions = useMemo(() => ({
    processPayment: async (amount, cardToken) => {
      setIsProcessing(true)
      setError(null)
      try {
        return await paymentAPI.charge(amount, cardToken)
      } catch (e) {
        setError(e as Error)
        throw e
      } finally {
        setIsProcessing(false)
      }
    },
    validateCard: (cardNumber) => {
      // validation logic
      return { isValid: true }
    }
  }), [])
  
  return { actions, isProcessing, error }
}
```

### 复用到新项目的步骤

1. **复制文件**：将 `providers/auth-provider.tsx` 或 `hooks/use-payment.ts` 复制到新项目
2. **配置环境**：修改 API endpoints（如果使用环境变量则无需修改）
3. **引入使用**：
   - Provider：在 `layout.tsx` 中 wrap
   - Hook：在需要的组件中 import

---

## Skills 优先级筛选

### P0: 必须遵守

| 规则 | 来源 | 说明 |
|-----|------|------|
| Context `state/actions/meta` 接口 | Composition 2.2 | 所有 Provider 统一接口 |
| Provider 状态提升 | Composition 2.3 | Global State 必须在 Layout |
| `Promise.all()` 并行请求 | Best Practices 1.4 | 独立请求不能串行 |
| Suspense Boundaries | Best Practices 1.5 | 异步组件必须有 fallback |

### P1: 推荐遵守

| 规则 | 来源 | 说明 |
|-----|------|------|
| 避免 Boolean Prop 泛滥 | Composition 1.1 | 用显式变体组件代替 |
| SWR 客户端去重 | Best Practices 4.3 | 交互后的数据获取 |
| 函数式 setState | Best Practices 5.9 | 避免闭包陷阱 |
| RSC 序列化最小化 | Best Practices 3.4 | 只传 client 需要的字段 |

### P2: 项目成熟后考虑

| 规则 | 来源 | 说明 |
|-----|------|------|
| Bundle 优化 | Best Practices 2.x | barrel imports, dynamic imports |
| LRU 跨请求缓存 | Best Practices 3.3 | 高流量场景 |
| React.cache() | Best Practices 3.6 | 同一请求周期去重 |

---

## Hard Rules (Data)

- **Global State** 必须在 `layout.tsx` 的 Provider 中定义，禁止在 Page 或 Component 中
- **L1-L4 组件** 只能 CONSUME context（调用 actions），不能 MANAGE 状态（定义 useState）
- **L2.5 Compound** 的状态只能是 UI 状态（isOpen, activeTab），不能是业务数据
- **独立的数据请求** 必须使用 `Promise.all()` 并行获取，禁止串行 await
- **异步组件** 必须用 `<Suspense>` 包裹并提供 skeleton fallback

---

## Before Submitting Code, Verify (Data)

**State Management:**
- [ ] Global state (theme, auth, cart) is defined in Layout-level Providers
- [ ] Page-specific state stays in page.tsx, not leaked to Blocks
- [ ] L1-L4 components only CONSUME context (call actions), never MANAGE state
- [ ] Context follows `{ state, actions, meta? }` interface pattern

**Data Fetching:**
- [ ] Independent fetches use `Promise.all()` for parallelism
- [ ] Async components are wrapped in `<Suspense>` with skeleton fallback
- [ ] No data fetching logic in L1-L4 components (only via props or context)

**Reusable Modules:**
- [ ] Module is self-contained (types, API calls, state in one file)
- [ ] No hardcoded project-specific values (use env vars or config)
- [ ] Provider uses `{ state, actions, meta? }` interface
- [ ] Hook returns `{ actions, isLoading, error }` or similar consistent interface