# Aify: AI Style Transformer Extension

**Aify** is a browser extension that enables you to easily change the style of any content on a webpage using AI. It works with local language models and is highly configurable, making it easy to customize your browsing experience. Whether you're transforming the tone, wording, or style of text on a page, Aify can handle it—all you need is an OpenAI-compatible API.

## Features

- **Style Transformation**: Change the style of any content on a webpage with AI.
- **Local LLMs**: Works with local large language models for quick and private processing.
- **Configurable**: Customize settings, including API credentials, for seamless integration with OpenAI-compatible models.
- **Easy to Use**: Simple interface with a popup to configure your settings and start transforming content.

## Installation

To get started with Aify, follow these steps:

### 1. Clone the Repository

```bash
git clone https://github.com/amirrezasalimi/aify.git
cd aify
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Run the Development Server

To run the extension in development mode:

```bash
npm run dev
```

This will start a local server for you to test and develop further.

### 4. Build the Extension

To package the extension for Chrome:

```bash
npm run build
```

The extension's files will be generated in the `/dist` directory.

### 5. Load the Extension into Chrome

1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer mode** at the top right.
3. Click on **Load unpacked** and select the `/dist` directory.

Your extension will now be available to use!

## How to Use

1. **Select Text**: Highlight any text you want to change on a webpage.
2. **Open the Style Panel**: Once you select a range of text, the Style Panel will appear at the bottom of the page.
3. **Choose a Style**: In the Syle Panel, you'll see a list of different styles you can apply to the selected text. Simply choose the style you prefer.
4. **Enjoy**: The selected text will be transformed according to the chosen style!

## Configuration

1. Open the extension popup by clicking the extension icon in the Chrome toolbar.
2. Enter your OpenAI-compatible API settings in the configuration panel.
3. Start transforming content!

## Author

[Amirreza](https://github.com/amirrezasalimi)

## Contributing

Contributions are welcome! If you'd like to contribute to Aify, feel free to open issues or submit pull requests.
