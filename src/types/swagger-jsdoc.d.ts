declare module 'swagger-jsdoc' {
  namespace swaggerJSDoc {
    // Loose but non-`any` typing for options to satisfy strict lint rules.
    // Consumers can still pass arbitrary keys; keep shape permissive.
    export type Options = Record<string, unknown>;
  }

  // Returns the generated OpenAPI specification as a plain object.
  function swaggerJSDoc(options: swaggerJSDoc.Options): Record<string, unknown>;

  export default swaggerJSDoc;
}
