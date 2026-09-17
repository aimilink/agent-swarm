(function () {
  "use strict";
  const extensionKinds = {
    md: "markdown", markdown: "markdown", json: "json",
    csv: "table", tsv: "table", xls: "table", xlsx: "table",
    html: "html", htm: "html",
    png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", svg: "image",
    pdf: "pdf", js: "code", ts: "code", tsx: "code", jsx: "code", py: "code",
    sh: "code", bash: "code", css: "code", yaml: "config", yml: "config", toml: "config", ini: "config",
  };
  const labels = {
    markdown: "MD", json: "{}", table: "CSV", html: "<>", image: "IMG",
    pdf: "PDF", code: "</>", config: "CFG", text: "TXT", file: "FILE",
  };
  const folderIcon = '<svg class="workspace-tree__folder-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 7.5h6.2l1.8 2h9v7.2a2.3 2.3 0 0 1-2.3 2.3H5.8a2.3 2.3 0 0 1-2.3-2.3z"/><path d="M3.5 9.5V7.3A2.3 2.3 0 0 1 5.8 5h3.1l2 2.1h7.3a2.3 2.3 0 0 1 2.3 2.3"/></svg>';
  const chevron = '<svg class="workspace-tree__chevron" viewBox="0 0 16 16" aria-hidden="true"><path d="m5.5 3.5 4.5 4.5-4.5 4.5"/></svg>';
  const downloadIcon = '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3v9m-3.5-3.5L10 12l3.5-3.5M4 15.5h12"/></svg>';

  class WorkspaceTree {
    constructor(options = {}) {
      this.escapeHtml = options.escapeHtml || (value => String(value ?? ""));
      this.formatSize = options.formatSize || (value => String(value ?? ""));
    }

    fileKind(file) {
      if (file.preview_type === "image") return "image";
      if (file.preview_type === "pdf") return "pdf";
      const suffix = String(file.name || file.path || "").split(".").pop().toLowerCase();
      return extensionKinds[suffix] || (file.preview_type === "text" ? "text" : "file");
    }

    render(files, options = {}) {
      const escapeHtml = this.escapeHtml;
      const formatSize = this.formatSize;
      const selectedPath = options.selectedPath || "";
      const collapsedDirectories = options.collapsedDirectories || new Set();
      const root = {directories: new Map(), files: []};
      files.forEach(file => {
        const parts = String(file.path || "").split("/").filter(Boolean);
        let node = root;
        parts.slice(0, -1).forEach(part => {
          if (!node.directories.has(part)) node.directories.set(part, {directories: new Map(), files: []});
          node = node.directories.get(part);
        });
        node.files.push(file);
      });

      const renderNode = (node, parents = []) => {
        const directories = [...node.directories.entries()].sort(([a], [b]) => a.localeCompare(b));
        const entries = directories.map(([name, child]) => {
          const directoryPath = [...parents, name].join("/");
          const open = !collapsedDirectories.has(directoryPath);
          return '<details class="project-tree-directory workspace-tree__directory" data-directory-path="' + escapeHtml(directoryPath) + '" ' + (open ? "open" : "") + '>' +
            '<summary aria-label="' + escapeHtml(name) + ' 文件夹">' + chevron + folderIcon + '<strong>' + escapeHtml(name) + '</strong></summary>' +
            '<div class="workspace-tree__children">' + renderNode(child, [...parents, name]) + '</div></details>';
        });
        const sortedFiles = [...node.files].sort((a, b) => String(a.name).localeCompare(String(b.name)));
        entries.push(...sortedFiles.map(file => {
          const kind = this.fileKind(file);
          const artifact = file.is_artifact ? '<span class="workspace-tree__artifact">产物</span>' : "";
          return '<div class="project-file-row workspace-tree__file" data-preview-type="' + escapeHtml(file.preview_type) + '" data-file-kind="' + kind + '">' +
            '<button type="button" class="workspace-tree__open" data-workspace-open="' + escapeHtml(file.path) + '" aria-label="预览 ' + escapeHtml(file.path) + '" aria-pressed="' + (file.path === selectedPath) + '" title="' + escapeHtml(file.path) + '">' +
            '<span class="workspace-tree__file-icon workspace-tree__file-icon--' + kind + '" aria-hidden="true">' + escapeHtml(labels[kind] || labels.file) + '</span>' +
            '<span class="workspace-tree__name">' + escapeHtml(file.name) + '</span>' + artifact + '<small>' + escapeHtml(formatSize(file.size)) + '</small></button>' +
            '<button type="button" class="workspace-tree__download" data-workspace-download="' + escapeHtml(file.path) + '" aria-label="下载 ' + escapeHtml(file.path) + '" title="下载">' + downloadIcon + '</button></div>';
        }));
        return entries.join("");
      };

      return '<div class="project-tree-root workspace-tree" data-tree-plugin="workspace-tree">' +
        '<div class="project-tree-root-label workspace-tree__root">' + chevron + folderIcon + '<strong>workspace</strong><small>' + files.length + ' 项</small></div>' +
        '<div class="project-tree-children workspace-tree__children">' + renderNode(root) + '</div></div>';
    }
  }
  window.WorkspaceTree = WorkspaceTree;
})();
