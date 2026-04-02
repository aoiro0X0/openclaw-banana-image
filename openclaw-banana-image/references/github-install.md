# GitHub Install Guidance

This skill is intended to be stored in a GitHub repository as a plain skill folder.

## Recommended Repo Layout

Use one of these layouts:

- repo root contains `openclaw-banana-image/`
- or a shared skills repo contains `skills/openclaw-banana-image/`

The important rule is that the URL points to the folder whose basename is the skill name.

## Agent-readable GitHub URLs

Examples an agent can consume with `$skill-installer`:

```text
https://github.com/<owner>/<repo>/tree/main/openclaw-banana-image
https://github.com/<owner>/<repo>/tree/main/skills/openclaw-banana-image
https://github.com/<owner>/<repo>/tree/<tag-or-branch>/openclaw-banana-image
```

## Prompt Examples

Short form:

```text
Install this skill from https://github.com/<owner>/<repo>/tree/main/openclaw-banana-image
```

Explicit form:

```text
Use $skill-installer to install this skill from https://github.com/<owner>/<repo>/tree/main/openclaw-banana-image
```

## Publishing Checklist

Before sharing the GitHub link, make sure the folder contains at least:

- `SKILL.md`
- `agents/openai.yaml`
- `scripts/banana-image.mjs`
- `references/`

No npm packaging is required for agent-based GitHub installation.