import React from "react"
import { vi } from "vitest"
import "@testing-library/jest-dom/vitest"

type MockImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src"
> & {
  fill?: boolean
  src: string | { src: string }
}

type MockLinkProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  "href"
> & {
  href: string | { pathname?: string; toString(): string }
  children?: React.ReactNode
}

vi.mock("next/image", () => ({
  default: (props: MockImageProps) => {
    const { fill, src, ...imageProps } = props
    void fill

    return React.createElement("img", {
      ...imageProps,
      src: typeof src === "string" ? src : src.src,
    })
  },
}))

vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: MockLinkProps) =>
    React.createElement(
      "a",
      {
        ...props,
        href: typeof href === "string" ? href : href.pathname || href.toString(),
      },
      children
    ),
}))

function createStorageMock(): Storage {
  const data = new Map<string, string>()

  return {
    get length() {
      return data.size
    },
    clear() {
      data.clear()
    },
    getItem(key: string) {
      return data.has(key) ? data.get(key)! : null
    },
    key(index: number) {
      return Array.from(data.keys())[index] ?? null
    },
    removeItem(key: string) {
      data.delete(key)
    },
    setItem(key: string, value: string) {
      data.set(key, String(value))
    },
  }
}

Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: createStorageMock(),
})

Object.defineProperty(window, "sessionStorage", {
  configurable: true,
  value: createStorageMock(),
})
