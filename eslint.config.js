// eslint.config.js
const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
	js.configs.recommended,
	{
		languageOptions: {
			ecmaVersion: "latest",
			sourceType: "commonjs",
			globals: {
				...globals.node,
			},
		},
		rules: {
			"no-undef": "error",
			"no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
			"no-empty-function": "warn",
			"no-console": "off",
			semi: ["error", "always"],
		},
	},
];
