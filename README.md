<div align="center">
  <img src="logo/logo.png" alt="Xeno.JS logo" width="140" />

  <h1>Xeno.JS Core</h1>
  <p><strong>Application architecture for TypeScript and Node.js.</strong></p>
  <p>Compose services, request context, CQRS pipelines, and infrastructure through explicit boundaries.</p>

  <p>
    <a href="https://github.com/xeno-js/xeno-shared">
      <img src="https://img.shields.io/github/stars/xeno-js/xeno-shared?style=flat-square" alt="GitHub Stars" />
    </a>
    <a href="https://www.npmjs.com/package/@xeno-js/core"><img src="https://img.shields.io/npm/v/@xeno-js/core?style=flat-square" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/@xeno-js/core"><img src="https://img.shields.io/npm/dt/@xeno-js/core?style=flat-square" alt="npm downloads" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="MIT license" /></a>
    <a href="https://buymeacoffee.com/xenojs">
      <img src="https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-FFdd00?style=flat-square&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" />
    </a>
  </p>
</div>

---

`@xeno-js/core` provides the runtime and composition APIs for Xeno.JS. It acts
as the composition root, managing Dependency Injection (DI), isolated request
contexts, and Command/Query pipelines, keeping application use cases independent
of transport and provider-specific implementations.

## Install

```bash
npm install @xeno-js/core

```

The package requires Node.js 20 or newer. `@xeno-js/shared` is a required peer
dependency.

---

## 1. Bootstrapping the Application

**Problem:** Node.js applications often suffer from fragmented initialization
where loggers, database connections, and DI containers are configured in
disparate files, making the startup sequence unpredictable.

**Principle:** Composition must be explicit, sequential, and isolated from the
transport layer.

**Mechanism:** `XenoAppBuilder` exposes a fluent API to queue module
configurations. It initializes the queued modules in ascending priority order
when `build()` is called.

**Implementation:**

```ts
import { XenoAppBuilder, withConsoleLogger, LOG_LEVEL } from '@xeno-js/core'
import type { ApplicationRegistry } from '@xeno-js/shared'

import { IPaymentService, PaymentService } from './payments'

interface AppRegistry extends ApplicationRegistry {
  paymentService: IPaymentService
}

const app = await new XenoAppBuilder<AppRegistry>()
  // 1. Configure Plugins
  .addLogger(
    withConsoleLogger((opts) => {
      opts.level = LOG_LEVEL.INFO
      opts.isEnabled = true
    }),
  )
  // 2. Register Dependencies
  .addServices((container) => {
    container.addSingleton(
      'paymentService',
      (c) => new PaymentService(c.resolve(TOKENS.LOGGER)),
    )
  })
  // 3. Initialize Runtime
  .build()
```

**Behavior:** Modules initialize sequentially. Repeated calls to `build()`
safely return the cached promise of the first successful build. If a module
fails during bootstrap, the container is safely disposed, and the error is
rethrown.

**Boundary:** The builder composes the backend runtime. It does not
automatically start an HTTP server listener; calling `.listen()` is required if
HTTP modules are attached.

---

## 2. Dependency Injection and Context Isolation

**Problem:** Sharing state or database transactions across concurrent
asynchronous operations leads to data leaks and race conditions.

**Principle:** Request-bound dependencies must be explicitly scoped and securely
isolated.

**Mechanism:** The `ServiceContainer` provides strict `Singleton`, `Scoped`, and
`Transient` lifetimes. `AsyncLocalStorage` isolates the execution context. The
container explicitly prevents _Captive Dependencies_ (injecting a Scoped service
into a Singleton).

**Implementation:**

```ts
// 1. Registration
builder.addServices((container) => {
  container.addScoped('paymentProcessor', (scope) => new PaymentProcessor())

  // This will throw a [DI Captive Dependency Error] at runtime to prevent leaks:
  // container.addSingleton('appManager', (scope) => new AppManager(scope.resolve('paymentProcessor')));
})

const app = await builder.build()

// 2. Execution outside HTTP (e.g., Background Workers, CLI)
await app.runInScope(
  async (services) => {
    const processor = services.paymentProcessor
    await processor.execute()
  },
  {
    identity: { userId: 'usr_123', tenantId: 'tenant_abc' },
  },
)
```

**Behavior:** `runInScope` generates a synthetic request context containing
trace IDs and network context. The active scope tracks disposable instances
(`IDisposable`) and automatically disposes them in a `finally` block when the
operation completes or fails.

**Boundary:** The container throws `[DI Container Error]` if a developer
attempts to resolve a `Scoped` service directly from the root container outside
of an active scope.

---

## 3. CQRS and Cross-Cutting Pipelines

**Problem:** Business use cases become polluted when authentication, validation,
performance tracking, and idempotency logic are hardcoded directly into the
handlers.

**Principle:** Separate the execution of a use case from the behaviors that wrap
it.

**Mechanism:** The `addPipeline()` method configures the CQRS module.
`PipelinePlugin` extensions decorate the `Mediator` dispatch process using a
chain of responsibility (Composite Pipeline).

**Implementation:**

```ts
import {
  withPerformance,
  withConcurrency,
  withIdempotency,
} from '@xeno-js/core'

// Configure the builder with pipeline behaviors
const app = await new XenoAppBuilder()
  .addPipeline([
    withPerformance((opts) => {
      opts.thresholdMs = 500 // Logs warnings for slow handlers
    }),
    withConcurrency((opts) => {
      // Manage concurrency
      opts.maxRetries = 3
      opts.delayConfig = {
        baseDelayMs: 100,
        maxJitterMs: 40,
      }
    }),
    withQueryCaching(), // For caching the query request
    withIdempotency(), // Relies on IIdempotencyStore (e.g., Redis plugin)
  ])
  .build()
```

**Behavior:** When a command is dispatched via the Mediator, it sequentially
passes through the configured behaviors (e.g., checking idempotency, enforcing
concurrency limits) before reaching the concrete handler.

**Boundary:** `addPipeline()` orchestrates the flow. It does not provide the
concrete infrastructure implementations (e.g., validation schemas or caching
storage). You must provide the respective adapters (like `@xeno-js/zod` or
`@xeno-js/redis`).

---

## Integrations

`@xeno-js/core` relies on adapter packages to connect infrastructure and
presentation layers. Register them via the builder extension points:

- [`@xeno-js/fastify`](https://github.com/xeno-js/fastify) - HTTP Transport
- [`@xeno-js/postgresql`](https://github.com/xeno-js/postgresql) -
  Drizzle/PostgreSQL Data Access
- [`@xeno-js/redis`](https://github.com/xeno-js/redis) - Caching and Idempotency
  store

## License

Xeno.JS Core is released under the [MIT License](LICENSE).
