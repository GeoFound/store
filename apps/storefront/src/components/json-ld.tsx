import type { JsonLdObject } from "@/lib/structured-data"

/**
 * Renders one or more schema.org objects as a JSON-LD script tag. `<` is escaped
 * to `<` so structured-data values can never break out of the script.
 */
export function JsonLd({ data }: { data: JsonLdObject | JsonLdObject[] }) {
  const payload = Array.isArray(data)
    ? data.length === 1
      ? data[0]
      : data
    : data
  const json = JSON.stringify(payload).replace(/</g, "\\u003c")

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  )
}
