
// Color schemes
export const colorSchemes = {
    'desert-oasis': {
        '--scene-bg': '#f8f5dc',
        '--editor-bg': '#e8e5cc',
        '--editor-fg': '#3c3836',
        sceneBg: 0xf8f5dc
    },
    'iceberg-light': {
        '--scene-bg': '#e8f1f8',
        '--editor-bg': '#d8e1e8',
        '--editor-fg': '#22223b',
        sceneBg: 0xe8f1f8
    },
    'cheesecake': {
        '--scene-bg': '#fffbe6',
        '--editor-bg': '#efebd6',
        '--editor-fg': '#222',
        sceneBg: 0xfffbe6
    },
    'gruvbox-light': {
        '--scene-bg': '#fbf1c7',
        '--editor-bg': '#ebe1b7',
        '--editor-fg': '#3c3836',
        sceneBg: 0xfbf1c7
    },
    'blueberry-light': {
        '--scene-bg': '#e3eafc',
        '--editor-bg': '#d3daec',
        '--editor-fg': '#22223b',
        sceneBg: 0xe3eafc
    },
    'darling': {
        '--scene-bg': '#fff0f6',
        '--editor-bg': '#efe0e6',
        '--editor-fg': '#22223b',
        sceneBg: 0xfff0f6
    },
    'dracula': {
        '--scene-bg': '#282a36',
        '--editor-bg': '#181a26',
        '--editor-fg': '#f8f8f2',
        sceneBg: 0x282a36
    },
    'monokai': {
        '--scene-bg': '#272822',
        '--editor-bg': '#171812',
        '--editor-fg': '#f8f8f2',
        sceneBg: 0x272822
    },
    'nord': {
        '--scene-bg': '#2e3440',
        '--editor-bg': '#1e2430',
        '--editor-fg': '#d8dee9',
        sceneBg: 0x2e3440
    },
    'gruvbox-dark': {
        '--scene-bg': '#282828',
        '--editor-bg': '#181818',
        '--editor-fg': '#ebdbb2',
        sceneBg: 0x282828
    },
    'paper': {
        '--scene-bg': '#f5f5dc',
        '--editor-bg': '#e5e5cc',
        '--editor-fg': '#222',
        sceneBg: 0xf5f5dc
    }
};

export function applyColorScheme(scheme, tunnelSystem) {
    const vars = colorSchemes[scheme];
    for (const key in vars) {
        if (key.startsWith('--')) {
        document.documentElement.style.setProperty(key, vars[key]);
        }
    }
    tunnelSystem?.changeColorScheme(vars);
}