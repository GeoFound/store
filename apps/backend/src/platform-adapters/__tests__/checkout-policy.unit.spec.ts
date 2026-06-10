import {
  getCheckoutPolicy,
  hasSupplierBackorderPath,
  hasSupplierMetadataPath,
  isOutOfStockReservationError,
  parseOutOfStockPolicy,
} from "../checkout-policy"
import { SUPPLIER_PROCUREMENT_MODULE } from "../../modules/supplier-procurement"

describe("checkout policy", () => {
  it("defaults to blocking out-of-stock checkout and manual supplier review", () => {
    expect(getCheckoutPolicy({})).toEqual({
      outOfStockPolicy: "block",
      supplierAutoProcurementEnabled: false,
    })
  })

  it("accepts supplier backorder as an explicit out-of-stock policy", () => {
    expect(parseOutOfStockPolicy("allow_supplier_backorder")).toBe(
      "allow_supplier_backorder"
    )
    expect(
      getCheckoutPolicy({
        CHECKOUT_OUT_OF_STOCK_POLICY: "allow_supplier_backorder",
        SUPPLIER_AUTO_PROCUREMENT_ENABLED: "true",
      })
    ).toEqual({
      outOfStockPolicy: "allow_supplier_backorder",
      supplierAutoProcurementEnabled: true,
    })
  })

  it("rejects invalid out-of-stock policies", () => {
    expect(() => parseOutOfStockPolicy("allow_everything")).toThrow(
      "CHECKOUT_OUT_OF_STOCK_POLICY"
    )
  })

  it("detects direct supplier metadata", () => {
    expect(
      hasSupplierMetadataPath({
        supplier_provider: "reloadly",
        supplier_sku: "amazon-jp-1000",
      })
    ).toBe(true)
  })

  it("detects supplier mapping fallback", async () => {
    const listMappingsSafe = jest.fn().mockResolvedValue([
      {
        id: "map_1",
      },
    ])
    const scope: any = {
      resolve: jest.fn((token) => {
        if (token === SUPPLIER_PROCUREMENT_MODULE) {
          return {
            listMappingsSafe,
          }
        }

        throw new Error(`Unexpected token ${String(token)}`)
      }),
    }

    await expect(
      hasSupplierBackorderPath({
        scope,
        productVariantId: "variant_1",
        metadata: {},
      })
    ).resolves.toBe(true)
    expect(listMappingsSafe).toHaveBeenCalledWith({
      productVariantId: "variant_1",
      enabled: true,
      limit: 1,
    })
  })

  it("classifies inventory shortage errors", () => {
    expect(
      isOutOfStockReservationError(
        new Error("Not enough credential inventory available")
      )
    ).toBe(true)
    expect(isOutOfStockReservationError(new Error("database is down"))).toBe(false)
  })
})
