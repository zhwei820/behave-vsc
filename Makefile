.PHONY: help install build package clean test vsix

# Default target
help:
	@echo "Available targets:"
	@echo "  make install  - Install dependencies"
	@echo "  make build    - Build the extension"
	@echo "  make package  - Package the extension (webpack)"
	@echo "  make vsix     - Create VSIX package file"
	@echo "  make test     - Run tests"
	@echo "  make clean    - Clean build artifacts"

# Install dependencies
install:
	npm install
	@echo "Checking for vsce..."
	@which vsce > /dev/null || (echo "Installing vsce..." && npm install -g @vscode/vsce)

# Build the extension (development)
build:
	npm run compile

# Package the extension (production build)
package:
	npm run package

# Create VSIX package (skip tests)
vsix: clean install

	@echo "Building production version (skipping tests)..."
	npm run package
	@echo "Creating VSIX package..."
	vsce package --out ./dist/
	@echo "VSIX package created in ./dist/ directory"
	@ls -lh ./dist/*.vsix

# Run tests
test:
	npm run test

# Clean build artifacts
clean:
	npm run clean-output
	rm -rf dist/*.vsix
	@echo "Build artifacts cleaned"
