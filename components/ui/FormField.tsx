// Named `Field` in the original implementation (matching the local `<Field>`
// helper it replaces in app/admin/activities/page.tsx); re-exported here as
// `FormField` too since that's the name used elsewhere in this project's
// task planning docs. Both imports resolve to the same component — prefer
// `Field` for new code, this file exists purely for naming compatibility.
export { default, default as FormField } from './Field'
export type { FieldProps, FieldProps as FormFieldProps } from './Field'
