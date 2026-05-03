import type { Root, Paragraph, Text } from "mdast";
import type { Plugin } from "unified";

const remarkAdmonitions: Plugin<[], Root> = () => {
  return (tree: Root) => {
    const newChildren: Root["children"] = [];
    let i = 0;

    while (i < tree.children.length) {
      const node = tree.children[i];

      if (
        node.type === "paragraph" &&
        node.children.length > 0 &&
        node.children[0].type === "text"
      ) {
        const firstChild = node.children[0] as Text;
        const lines = firstChild.value.split("\n");
        const firstLine = lines[0];

        const match = firstLine.match(/^!!!\s*(\w+)\s*(.*)?$/);
        if (match) {
          const admonitionType = match[1] || "note";
          const title = match[2]?.trim() || "";

          // Collect indented content from remaining lines of first paragraph
          const contentLines: string[] = [];
          for (let j = 1; j < lines.length; j++) {
            const line = lines[j];
            if (line.match(/^(\s{4}|\t)/)) {
              contentLines.push(line.replace(/^(\s{4}|\t)/, ""));
            } else if (line.trim() === "") {
              contentLines.push("");
            } else {
              break;
            }
          }

          // Collect indented content from subsequent paragraph nodes
          let k = i + 1;
          while (k < tree.children.length) {
            const nextNode = tree.children[k];
            if (
              nextNode.type === "paragraph" &&
              nextNode.children.length > 0 &&
              nextNode.children[0].type === "text"
            ) {
              const nextText = nextNode.children[0] as Text;
              const nextLines = nextText.value.split("\n");
              let allIndented = true;
              for (const line of nextLines) {
                if (line.trim() !== "" && !line.match(/^(\s{4}|\t)/)) {
                  allIndented = false;
                  break;
                }
              }
              if (allIndented) {
                for (const line of nextLines) {
                  contentLines.push(line.replace(/^(\s{4}|\t)/, ""));
                }
                k++;
                continue;
              }
            }
            break;
          }

          i = k;

          // Skip empty admonitions
          const contentText = contentLines.join("\n").trim();
          if (!contentText) continue;

          // Build as standard element nodes (not custom types)
          const admonitionNode = {
            type: "element",
            tagName: "div",
            properties: {
              className: ["admonition", `admonition-${admonitionType}`],
            },
            children: [
              {
                type: "element",
                tagName: "div",
                properties: { className: ["admonition-title"] },
                children: [
                  { type: "text", value: title || admonitionType.toUpperCase() },
                ],
              },
              {
                type: "element",
                tagName: "div",
                properties: { className: ["admonition-content"] },
                children: [
                  {
                    type: "element",
                    tagName: "p",
                    properties: {},
                    children: [{ type: "text", value: contentText }],
                  },
                ],
              },
            ],
          };

          newChildren.push(admonitionNode as any);
          continue;
        }
      }

      newChildren.push(node);
      i++;
    }

    tree.children = newChildren;
  };
};

export default remarkAdmonitions;
