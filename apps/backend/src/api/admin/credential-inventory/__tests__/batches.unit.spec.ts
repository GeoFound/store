import { POST } from "../batches/route"

function createResponse() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn(),
  }
}

function createRequest(graph: jest.Mock, body?: Record<string, unknown>) {
  return {
    body: {
      name: "test import",
      product_variant_id: "variant_test",
      template_code: "credential",
      items: [{ credential: "secret" }],
      ...(body || {}),
    },
    headers: {
      "accept-language": "en",
    },
    scope: {
      resolve: jest.fn(() => ({
        graph,
      })),
    },
  }
}

describe("admin credential inventory batches", () => {
  it("rejects imports for a missing product variant before creating inventory", async () => {
    const graph = jest.fn().mockResolvedValue({ data: [] })
    const req = createRequest(graph)
    const res = createResponse()

    await POST(req as never, res as never)

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({
      message: "Product variant variant_test was not found",
    })
  })

  it("rejects imports for variants that do not use credential inventory", async () => {
    const graph = jest.fn().mockResolvedValue({
      data: [
        {
          id: "variant_test",
          metadata: {},
          product: {
            type: {
              value: "manual",
            },
            metadata: {},
          },
        },
      ],
    })
    const req = createRequest(graph)
    const res = createResponse()

    await POST(req as never, res as never)

    expect(res.status).toHaveBeenCalledWith(400)
    expect(res.json).toHaveBeenCalledWith({
      message:
        "Product variant variant_test uses inventory handler noop and cannot receive credential inventory",
    })
  })
})
