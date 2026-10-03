module.exports = function ({ types: t }) {
  const isOwnSource = state => !/node_modules|[\\/]localization[\\/]|[\\/]test[\\/]|\.test\./.test(state.filename || "");
  function addImport(nodePath, state, name) {
    state.dtImports ??= {};
    if (!state.dtImports[name]) {
      state.dtImports[name] = nodePath.scope.getProgramParent().generateUidIdentifier(name);
      const program = nodePath.findParent(parent => parent.isProgram());
      program.unshiftContainer("body", t.importDeclaration(
        [t.importSpecifier(state.dtImports[name], t.identifier(name))],
        t.stringLiteral(name === "AnimatedText" ? "@/localization/components" : "@/localization/engine"),
      ));
    }
    return state.dtImports[name];
  }
  function sensitiveDisplay(node) {
    if (!node) return false;
    if (t.isLogicalExpression(node) || t.isConditionalExpression(node)) {
      return sensitiveDisplay(node.left) || sensitiveDisplay(node.right) ||
        sensitiveDisplay(node.consequent) || sensitiveDisplay(node.alternate);
    }
    const property = t.isIdentifier(node) ? node.name :
      (t.isMemberExpression(node) || t.isOptionalMemberExpression(node)) && t.isIdentifier(node.property) ? node.property.name : "";
    if (/^(?:fullName|firstName|lastName|userName|displayName|email|phone|iccid|smdpAddress|activationCode|confirmationNumber|fingerprint|passportNumber|code|iata|iataCode|airportCode|airlineCode|carrierCode|currencyCode|bookingReference|bookingId|orderId|token|password|adminKey)$/i.test(property)) return true;
    if (property === "name" && (t.isMemberExpression(node) || t.isOptionalMemberExpression(node))) {
      let object = node.object;
      while (t.isMemberExpression(object) || t.isOptionalMemberExpression(object)) object = object.object;
      return t.isIdentifier(object) && /user|customer|profile|passenger|account/i.test(object.name);
    }
    return false;
  }
  return {
    name: "dt-customer-language",
    visitor: {
      ImportDeclaration(nodePath, state) {
        if (!isOwnSource(state)) return;
        if (nodePath.node.source.value !== "react-native") return;
        state.dtNativeAnimated = nodePath.node.specifiers.some(specifier =>
          t.isImportSpecifier(specifier) && specifier.imported.name === "Animated" && specifier.local.name === "Animated");
        const translated = nodePath.node.specifiers.filter(specifier =>
          t.isImportSpecifier(specifier) && ["Text", "TextInput", "Alert", "Pressable", "TouchableOpacity", "Image"].includes(specifier.imported.name),
        );
        if (!translated.length) return;
        nodePath.node.specifiers = nodePath.node.specifiers.filter(specifier => !translated.includes(specifier));
        nodePath.insertAfter(t.importDeclaration(translated, t.stringLiteral("@/localization/components")));
      },
      JSXMemberExpression(nodePath, state) {
        if (!isOwnSource(state)) return;
        if (state.dtNativeAnimated && t.isJSXIdentifier(nodePath.node.object, { name: "Animated" }) && t.isJSXIdentifier(nodePath.node.property, { name: "Text" })) {
          nodePath.replaceWith(t.jsxIdentifier(addImport(nodePath, state, "AnimatedText").name));
        }
      },
      JSXOpeningElement(nodePath, state) {
        if (!isOwnSource(state) || !t.isJSXIdentifier(nodePath.node.name, { name: "Text" })) return;
        const children = nodePath.parent.children.filter(child => !t.isJSXText(child) || child.value.trim());
        if (children.length !== 1 || !t.isJSXExpressionContainer(children[0])) return;
        const expression = children[0].expression;
        if (sensitiveDisplay(expression)) {
          // Localize literal fallbacks such as "Guest" while preserving the
          // actual customer's name, reference or activation data verbatim.
          function localizeFallback(node) {
            if (t.isStringLiteral(node) && node.value.trim()) {
              return t.callExpression(t.cloneNode(addImport(nodePath, state, "localizeUi")), [node]);
            }
            if (t.isLogicalExpression(node)) node.right = localizeFallback(node.right);
            if (t.isConditionalExpression(node)) {
              node.consequent = localizeFallback(node.consequent);
              node.alternate = localizeFallback(node.alternate);
            }
            return node;
          }
          children[0].expression = localizeFallback(expression);
          nodePath.node.attributes.push(t.jsxAttribute(t.jsxIdentifier("dtDisplayData"), t.jsxExpressionContainer(t.booleanLiteral(true))));
        }
      },
    },
  };
};