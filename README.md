# Outline-dynamic
# Outline Dynamic Key

A simple Cloudflare Worker for serving dynamic Outline access keys.

## Features

- Dynamic key delivery
- Per-user access links
- Easy server migration
- No need to redistribute keys

## Usage

Import the following link into Outline Client:

```text
ssconf://your-worker.workers.dev/username
```

Example:

```text
ssconf://your-worker.workers.dev/demo
```

## Deployment

1. Create a Cloudflare Worker
2. Deploy the source code
3. Configure your users and access keys
4. Share the generated links

## License

MIT
