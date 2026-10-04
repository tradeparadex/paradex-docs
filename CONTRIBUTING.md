## Contributing

We welcome contributions from the community! Follow the steps below to get started.

> You can also choose to simply [submit an issue](https://github.com/tradeparadex/paradex-docs/issues/new/choose) and the team would be more than happy to look into this for you!

### Prerequisites

Make sure you have the following installed:
- [Node.js](https://nodejs.org/) 20 or later
- [Yarn](https://yarnpkg.com/) (run `corepack enable` once; the repo pins Yarn 4)

### Install Dependencies

First, clone the repository and navigate into the project directory:

```shell
git clone https://github.com/your-username/paradex-docs.git
cd paradex-docs
```

Then, install the project dependencies with:

```shell
yarn install
```

### Preview Docs

The site is built with [Docusaurus](https://docusaurus.io). To start a local preview with live reload, run:

```shell
yarn dev
```

> If everything goes right, you should see a message like:
>
> ```plain
> [SUCCESS] Docusaurus website is running at: http://localhost:3000/
> ```

Visit the URL in your browser to see the documentation.

To check a production build (this is what CI runs; it fails on broken links), run:

```shell
yarn build
yarn serve
```

Search only works on a production build (`yarn serve`).

### Where things live

- Pages: `docs/pages/` (MDX). Add new pages to `docs/navigation.yml`, which defines the tabs, sidebars and URLs.
- Release notes: `docs/release-notes/prod/`. Scaffold a new entry with `yarn new-release-note <version> --tags UI,API`.
- Redirects for moved pages: `docs/redirects.yml`.
- API reference: generated from `docs/apis/` (OpenAPI and AsyncAPI specs). Hand-written code samples go in `docs/apis/*/openapi/overrides.yml`.
- Images and PDFs: `docs/assets/`.

### Making Changes

1. **Create a new branch for your changes:**

    ```shell
    git checkout -b my-feature-branch
    ```

2. **Make your changes in the appropriate files.**

3. **Commit your changes with a meaningful commit message:**

    ```shell
    git commit -m "Add feature X"
    ```

4. **Push your changes to GitHub:**

    ```shell
    git push origin my-feature-branch
    ```

5. **Open a pull request on GitHub.**

    CI builds the site and comments a Cloudflare preview URL on the pull request. Merging to `main` publishes the site to https://docs.paradex.trade.

## Additional Resources
- [Paradex Documentation](https://docs.paradex.trade)
- [Paradex Code Samples](https://github.com/tradeparadex/code-samples)
- [Docusaurus Documentation](https://docusaurus.io/docs)
