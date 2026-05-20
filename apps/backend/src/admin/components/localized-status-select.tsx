import { Select } from "@medusajs/ui"
import { useTranslation } from "react-i18next"
import { translatedStatus } from "../lib/i18n"

type LocalizedStatusSelectProps = {
  value: string
  options: readonly string[]
  placeholder?: string
  onValueChange: (value: string) => void
}

export function LocalizedStatusSelect({
  value,
  options,
  placeholder,
  onValueChange,
}: LocalizedStatusSelectProps) {
  const { t } = useTranslation()

  return (
    <Select value={value} onValueChange={onValueChange}>
      <Select.Trigger>
        <Select.Value placeholder={placeholder || t("common.fields.status")} />
      </Select.Trigger>
      <Select.Content>
        {options.map((option) => (
          <Select.Item key={option} value={option}>
            {translatedStatus(t, option)}
          </Select.Item>
        ))}
      </Select.Content>
    </Select>
  )
}
