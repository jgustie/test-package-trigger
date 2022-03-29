const tc = require('@actions/tool-cache');
const core = require('@actions/core');
const fs = require('fs');
const { Octokit } = require('@octokit/rest')
const semver = require('semver')


async function run() {
    try {
        const versionSpec = core.getInput('kustomize-version');
        let toolPath = tc.find('kustomize', versionSpec);
        if (!toolPath) {
            toolPath = await downloadKustomize(versionSpec);
        } else {
            core.info(`Found in cache @ ${toolPath}`);
        }

        core.addPath(toolPath);
        core.info(`Successfully setup kustomize version ${versionSpec}`);
    } catch (error) {
        core.setFailed(error.message);
    }
}

async function downloadKustomize(versionSpec) {
    let version = '';
    let downloadURL = '';
    let os = process.platform;
    let arch = process.arch;
    if (arch === 'x64') {
        arch = 'amd64';
    }
    let toolPath = ''

    const octokit = new Octokit();
    octokit.paginate(octokit.rest.repos.listReleases, {
        owner: 'kubernetes-sigs',
        repo: 'kustomize',
    })
    .then((releases) => {
        for (const release of releases.filter(r => r.name.startsWith('kustomize/') && !r.prerelease)) {
            let versionName = release.name.substring(10);
            if (versionSpec === 'latest' || semver.satisfies(versionName, versionSpec, {})) {
                version = versionName;
                for (const asset of release.assets) {
                    if (asset.name === `kustomize_${version}_${os}_${arch}.tar.gz`) {
                        downloadURL = asset.browser_download_url;
                    }
                }
                break;
            }
        }
    });

    if (!version) {
        throw new Error(`Unable to resolve version ${versionSpec}`);
    }
    if (!downloadURL) {
        throw new Error(`Unable to find download for version ${version} (${os}/${arch})`);
    }

    if (version !== versionSpec) {
        toolPath = tc.find('kustomize', version);
        if (toolPath) {
            core.info(`Found in cache @ ${toolPath}`);
            return toolPath;
        }
    }

    core.info(`Attempting to download ${version} (${os}/${arch})...`);
    const downloadPath = await tc.downloadTool(downloadURL);
    const extracted = await tc.extractTar(downloadPath);

    toolPath = await tc.cacheFile(`${extracted}/kustomize`, 'kustomize', 'kustomize', version);
    core.info(`Successfully cached kustomize to ${toolPath}`);
    return toolPath;
}

run();
