/**
 * Table rules: td-headers-attr, th-has-data-cells, td-has-header,
 * table-duplicate-name, table-fake-caption, scope-attr-valid
 */

import type { FastNode } from "../tree.js";
import type { RuleCheck, RuleRunResult, NodeCheckDetail } from "../rule-engine.js";
import { makeCheck } from "../rule-engine.js";
import { isHiddenOrAncestorHidden, findByTag, getNodeText } from "../tree.js";

/** Find the closest ancestor <table>. */
function findAncestorTable(node: FastNode): FastNode | null {
  let current = node.parent;
  while (current) {
    if (current.tag === "table") return current;
    current = current.parent;
  }
  return null;
}

/** Get all <td> and <th> cells in a table, organized into a grid. */
function getTableGrid(table: FastNode): { rows: FastNode[][]; allCells: FastNode[] } {
  const rows: FastNode[][] = [];
  const allCells: FastNode[] = [];

  function walkForRows(node: FastNode) {
    if (node.tag === "tr") {
      const cells: FastNode[] = [];
      for (const child of node.children) {
        if (child.tag === "td" || child.tag === "th") {
          cells.push(child);
          allCells.push(child);
        }
      }
      rows.push(cells);
    } else {
      for (const child of node.children) {
        walkForRows(child);
      }
    }
  }

  walkForRows(table);
  return { rows, allCells };
}

/** Get all elements with an id inside a table. */
function getTableIds(table: FastNode): Map<string, FastNode> {
  const idMap = new Map<string, FastNode>();
  function walk(node: FastNode) {
    if (node.attrs.id) {
      idMap.set(node.attrs.id, node);
    }
    for (const child of node.children) {
      walk(child);
    }
  }
  walk(table);
  return idMap;
}

/* ------------------------------------------------------------------ */
/*  td-headers-attr                                                    */
/* ------------------------------------------------------------------ */
const tdHeadersAttr: RuleCheck = {
  ruleId: "td-headers-attr",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of findByTag(nodes, "td")) {
      if (isHiddenOrAncestorHidden(node)) continue;
      const headers = node.attrs.headers;
      if (!headers) continue;

      const table = findAncestorTable(node);
      if (!table) continue;

      const tableIds = getTableIds(table);
      const headerIds = headers.trim().split(/\s+/);
      const invalidIds = headerIds.filter((id) => !tableIds.has(id));

      // Also check that headers don't reference the cell itself
      const selfRef = node.attrs.id ? headerIds.includes(node.attrs.id) : false;

      if (invalidIds.length > 0 || selfRef) {
        violations.push(node);
        const reasons: string[] = [];
        if (invalidIds.length > 0) reasons.push("invalid ID(s): " + invalidIds.join(", "));
        if (selfRef) reasons.push("references itself");
        checkDetails.set(node, {
          all: [makeCheck("td-headers-attr", "serious",
            "headers attribute has " + reasons.join("; "))],
        });
      } else {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("td-headers-attr", "serious",
            "All headers IDs are valid references in the same table")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  th-has-data-cells                                                  */
/* ------------------------------------------------------------------ */
const thHasDataCells: RuleCheck = {
  ruleId: "th-has-data-cells",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    // Process each table
    const tables = findByTag(nodes, "table");
    for (const table of tables) {
      if (isHiddenOrAncestorHidden(table)) continue;

      // Skip layout tables (role="presentation" or role="none")
      const role = table.attrs.role;
      if (role === "presentation" || role === "none") continue;

      const { rows, allCells } = getTableGrid(table);
      const thCells = allCells.filter((c) => c.tag === "th");
      const tdCells = allCells.filter((c) => c.tag === "td");

      if (thCells.length === 0) continue;
      if (tdCells.length === 0 && thCells.length > 0) {
        // Table with only headers, no data cells
        for (const th of thCells) {
          violations.push(th);
          checkDetails.set(th, {
            all: [makeCheck("th-has-data-cells", "serious",
              "Table header has no associated data cells")],
          });
        }
        continue;
      }

      // For each th, check if it has at least one associated td
      for (const th of thCells) {
        const thId = th.attrs.id;
        let hasAssociatedData = false;

        // Check if any td references this th via headers attr
        if (thId) {
          hasAssociatedData = tdCells.some((td) => {
            const headers = td.attrs.headers;
            return headers && headers.trim().split(/\s+/).includes(thId);
          });
        }

        // Check by position (same row or same column)
        if (!hasAssociatedData) {
          for (let ri = 0; ri < rows.length; ri++) {
            const row = rows[ri];
            const thIndex = row.indexOf(th);
            if (thIndex >= 0) {
              // Check same row for td cells
              hasAssociatedData = row.some((c) => c.tag === "td");
              if (hasAssociatedData) break;

              // Check same column in other rows
              for (let rj = 0; rj < rows.length; rj++) {
                if (rj === ri) continue;
                if (rows[rj][thIndex] && rows[rj][thIndex].tag === "td") {
                  hasAssociatedData = true;
                  break;
                }
              }
              break;
            }
          }
        }

        if (hasAssociatedData) {
          passes.push(th);
          checkDetails.set(th, {
            all: [makeCheck("th-has-data-cells", "serious",
              "Table header has associated data cells")],
          });
        } else {
          violations.push(th);
          checkDetails.set(th, {
            all: [makeCheck("th-has-data-cells", "serious",
              "Table header has no associated data cells")],
          });
        }
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  td-has-header                                                      */
/* ------------------------------------------------------------------ */
const tdHasHeader: RuleCheck = {
  ruleId: "td-has-header",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    const tables = findByTag(nodes, "table");
    for (const table of tables) {
      if (isHiddenOrAncestorHidden(table)) continue;

      // Skip layout tables
      const role = table.attrs.role;
      if (role === "presentation" || role === "none") continue;

      const { rows, allCells } = getTableGrid(table);

      // Only check tables larger than 3x3
      const numRows = rows.length;
      const numCols = Math.max(0, ...rows.map((r) => r.length));
      if (numRows < 3 || numCols < 3) continue;

      // Find th cells for reference
      const thCells = allCells.filter((c) => c.tag === "th");
      if (thCells.length === 0) {
        // No headers in a large table — each non-empty td is a violation
        for (const row of rows) {
          for (const cell of row) {
            if (cell.tag === "td" && getNodeText(cell)) {
              violations.push(cell);
              checkDetails.set(cell, {
                all: [makeCheck("td-has-header", "serious",
                  "Data cell in a large table has no associated header")],
              });
            }
          }
        }
        continue;
      }

      // Build th id set
      const thIds = new Set(thCells.filter((th) => th.attrs.id).map((th) => th.attrs.id));

      for (let ri = 0; ri < rows.length; ri++) {
        const row = rows[ri];
        for (let ci = 0; ci < row.length; ci++) {
          const cell = row[ci];
          if (cell.tag !== "td") continue;
          if (!getNodeText(cell)) continue;

          let hasHeader = false;

          // Check headers attribute
          const headersAttr = cell.attrs.headers;
          if (headersAttr) {
            hasHeader = headersAttr.trim().split(/\s+/).some((id) => thIds.has(id));
          }

          // Check for th in same row
          if (!hasHeader) {
            hasHeader = row.some((c) => c.tag === "th");
          }

          // Check for th in same column
          if (!hasHeader) {
            for (let rj = 0; rj < rows.length; rj++) {
              if (rows[rj][ci] && rows[rj][ci].tag === "th") {
                hasHeader = true;
                break;
              }
            }
          }

          if (hasHeader) {
            passes.push(cell);
            checkDetails.set(cell, {
              all: [makeCheck("td-has-header", "serious",
                "Data cell has an associated table header")],
            });
          } else {
            violations.push(cell);
            checkDetails.set(cell, {
              all: [makeCheck("td-has-header", "serious",
                "Data cell in a large table has no associated header")],
            });
          }
        }
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  table-duplicate-name                                               */
/* ------------------------------------------------------------------ */
const tableDuplicateName: RuleCheck = {
  ruleId: "table-duplicate-name",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const table of findByTag(nodes, "table")) {
      if (isHiddenOrAncestorHidden(table)) continue;

      const summary = (table.attrs.summary || "").trim().toLowerCase();
      const captionNode = table.children.find((c) => c.tag === "caption");
      const caption = captionNode ? getNodeText(captionNode).trim().toLowerCase() : "";

      if (!summary || !caption) continue;

      if (summary === caption) {
        violations.push(table);
        checkDetails.set(table, {
          all: [makeCheck("table-duplicate-name", "minor",
            "Table caption and summary have identical text")],
        });
      } else {
        passes.push(table);
        checkDetails.set(table, {
          all: [makeCheck("table-duplicate-name", "minor",
            "Table caption and summary are different")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  table-fake-caption                                                 */
/* ------------------------------------------------------------------ */
const tableFakeCaption: RuleCheck = {
  ruleId: "table-fake-caption",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const table of findByTag(nodes, "table")) {
      if (isHiddenOrAncestorHidden(table)) continue;

      // Skip layout tables
      const role = table.attrs.role;
      if (role === "presentation" || role === "none") continue;

      const { rows } = getTableGrid(table);
      if (rows.length < 2) continue;

      const firstRow = rows[0];
      // Check if first row has a single cell that spans all columns
      if (firstRow.length === 1) {
        const cell = firstRow[0];
        const colspan = parseInt(cell.attrs.colspan || "1", 10);
        // Determine the max column count from other rows
        const maxCols = Math.max(...rows.slice(1).map((r) => r.length));

        if (colspan >= maxCols && maxCols > 1 && getNodeText(cell)) {
          violations.push(table);
          checkDetails.set(table, {
            all: [makeCheck("table-fake-caption", "serious",
              "First row contains a single cell spanning all columns — use <caption> instead")],
          });
          continue;
        }
      }

      passes.push(table);
      checkDetails.set(table, {
        all: [makeCheck("table-fake-caption", "serious",
          "Table does not use a fake caption")],
      });
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  scope-attr-valid                                                   */
/* ------------------------------------------------------------------ */
const VALID_SCOPES = new Set(["col", "row", "colgroup", "rowgroup"]);

const scopeAttrValid: RuleCheck = {
  ruleId: "scope-attr-valid",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;
      if (node.attrs.scope === undefined) continue;

      const scope = node.attrs.scope.toLowerCase();

      // scope should only be on th elements
      if (node.tag !== "th") {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("scope-attr-valid", "moderate",
            "scope attribute is only valid on <th> elements")],
        });
        continue;
      }

      if (VALID_SCOPES.has(scope)) {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("scope-attr-valid", "moderate",
            "scope attribute has a valid value: \"" + scope + "\"")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("scope-attr-valid", "moderate",
            "scope attribute has an invalid value: \"" + scope + "\"")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

export const tableRules: RuleCheck[] = [
  tdHeadersAttr,
  thHasDataCells,
  tdHasHeader,
  tableDuplicateName,
  tableFakeCaption,
  scopeAttrValid,
];
