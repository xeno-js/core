# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 4.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Xeno.JS and its ecosystem (`@xeno-js/core`,
`@xeno-js/vue`, `@xeno-js/shared`, `@xeno-js/cli`, `@xeno-js/fastify`,
`@xeno-js/postgresql`) very seriously. If you discover a security vulnerability
(such as an issue with the Double Submit Cookie CSRF protection, token
validation, or framework internals), please **do not disclose it publicly**
through GitHub issues or public forums.

Instead, please report it privately:

- **Email:** <xeno-js@outlook.it>

### What to include in your report

To help us triage and verify the issue as quickly as possible, please provide:

- A description of the vulnerability and its potential impact.
- Steps or a minimal proof-of-concept (PoC) code snippet to reproduce the issue.
- Any relevant logs, configuration details, or environment specifications.

### Our Response Process

1. **Acknowledgment:** We will acknowledge receipt of your vulnerability report
   within 48 hours.
2. **Investigation:** We will investigate the issue, verify its validity, and
   assess its impact on core components like the `CsrfTokenService` or
   authentication pipelines.
3. **Patch & Release:** Once a fix is developed and tested, we will issue a
   secure patch release and publish an advisory crediting the reporter (unless
   requested otherwise).

Thank you for helping keep Xeno.JS safe and robust for the community!
