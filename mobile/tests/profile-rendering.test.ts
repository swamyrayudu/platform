import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { transformSync } from 'esbuild';
import ts from 'typescript';

// Check the compiled JSX, because even a single inline JSX space is a text
// child at runtime. React Native View/Card cannot render that child.
for (const [name, path] of [
  ['Home', '../app/(tabs)/index.tsx'],
  ['Sign in', '../app/login.tsx'],
  ['Profile', '../app/(tabs)/profile.tsx'],
  ['Plans', '../app/subscription.tsx'],
  ['Plan card', '../components/subscription-plan-card.tsx'],
  ['Mock library', '../app/(tabs)/mocks.tsx'],
  ['Mock card', '../components/mock-paper-card.tsx'],
  ['Practice', '../app/(tabs)/practice.tsx'],
  ['Practice selectors', '../components/practice-selectors.tsx'],
  ['Practice choices', '../components/practice-choices.tsx'],
  ['Topic picker', '../components/topic-picker.tsx'],
  ['Mock start', '../app/mock/[id].tsx'],
  ['Exam', '../components/exam-screen.tsx'],
  ['Question report', '../components/report-question.tsx'],
  ['Alert dialog', '../components/alert-dialog.tsx'],
  ['Update popup', '../components/app-update.tsx'],
  ['Results', '../app/result.tsx'],
  ['Result summary', '../components/result-summary.tsx'],
  ['Answer review', '../components/question-review-card.tsx'],
  ['Review controls', '../components/review-controls.tsx'],
  ['Progress', '../app/(tabs)/performance.tsx'],
  ['Progress overview', '../components/progress-overview.tsx'],
  ['Performance chart', '../components/performance-chart.tsx'],
] as const) {
test(name + ' containers do not receive literal text children, including inline JSX spaces', () => {
  const source = readFileSync(new URL(path, import.meta.url), 'utf8');
  const compiled = transformSync(source, { loader: 'tsx', jsx: 'automatic' }).code;
  const tree = ts.createSourceFile('screen.js', compiled, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const invalid: string[] = [];
  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && /^jsxs?$/.test(node.expression.text)) {
      const [component, props] = node.arguments;
      if (component && ts.isIdentifier(component) && ['Card', 'Screen', 'View', 'Pressable', 'ProfileSection', 'SubscriptionPlanCard', 'PracticeSection'].includes(component.text) && props && ts.isObjectLiteralExpression(props)) {
        const children = props.properties.find(property => ts.isPropertyAssignment(property) && property.name.getText(tree) === 'children');
        if (children && ts.isPropertyAssignment(children)) {
          const values = ts.isArrayLiteralExpression(children.initializer) ? children.initializer.elements : [children.initializer];
          for (const value of values) if (ts.isStringLiteral(value) || ts.isNumericLiteral(value)) invalid.push(`${component.text}: ${value.getText(tree)}`);
        }
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert.deepEqual(invalid, [], 'Container children must be components; put literal text inside Text/Heading/Body.');
});
}
