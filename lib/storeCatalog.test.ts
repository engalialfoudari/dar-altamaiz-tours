import { parseServerCatalog } from "./storeCatalog";

describe("Travel Prep customer catalog", () => {
  it("represents the saved bilingual product exactly as shown in the admin preview", () => {
    const [product] = parseServerCatalog({
      products: [{
        product_id: "preview-adapter",
        title: "Compact Travel Adapter",
        title_ar: "محول سفر مدمج",
        description: "Fast charging adapter for international trips.",
        description_ar: "محول شحن سريع للرحلات الدولية.",
        category: "electrical",
        image_url: "https://cdn.example.com/products/adapter.webp",
        price_kwd: "12.500",
        available_stock: 7,
        active: true,
      }],
    });

    expect(product).toMatchObject({
      id: "preview-adapter",
      name: {
        en: "Compact Travel Adapter",
        ar: "محول سفر مدمج",
      },
      desc: {
        en: "Fast charging adapter for international trips.",
        ar: "محول شحن سريع للرحلات الدولية.",
      },
      category: "electrical",
      imageUrl: "https://cdn.example.com/products/adapter.webp",
      priceKwd: 12.5,
    });
  });
});