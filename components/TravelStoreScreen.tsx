import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, Pressable, FlatList, Image, Platform, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StoreCategory, StoreProduct } from "@/lib/storeCatalog";
import { useCart } from "@/lib/cartContext";
import colors from "@/constants/colors";
import { HotelPortalIcon } from "@/components/HotelPortalIcon";
import { WhatsAppIcon } from "@/components/WhatsAppIcon";

const C = {
  ...colors.light,
  navy: "#003580",
  blueLight: "#B9D8FA",
  canvasAlt: "#F2F2F2",
  whatsAppDark: "#075E54",
  whatsAppLight: "#E8F6F1",
};

interface TravelStoreScreenProps {
  onClose: () => void;
  lang: "en" | "ar";
  onOpenCart: () => void;
}

export function TravelStoreScreen({ onClose, lang, onOpenCart }: TravelStoreScreenProps) {
  const insets = useSafeAreaInsets();
  const { items, addToCart, updateQuantity, totalItems, stockByProductId, setStock, catalog } = useCart();
  const rtl = lang === "ar";
  const [activeCategory, setActiveCategory] = useState<StoreCategory | "all">("all");
  const [expandedProductId, setExpandedProductId] = useState<string | null>(null);
  const apiBase = (process.env.EXPO_PUBLIC_API_BASE || "https://tours-dar-altamaiz--engalialfoudari.replit.app/api").replace(/\/$/, "");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/store/products`, { signal: controller.signal }).then(async response => {
      if (!response.ok) return;
      const data = await response.json();
      const source = data?.stock || data?.products || data;
      const next: Record<string, number> = {};
      if (Array.isArray(source)) source.forEach((entry: any) => {
        const id = entry.productId || entry.product_id || entry.id;
        const available = entry.stock ?? entry.availableStock ?? entry.available_stock;
        if (id && Number.isFinite(Number(available))) next[id] = Math.max(0, Number(available));
      });
      else if (source && typeof source === "object") Object.keys(source).forEach(id => {
        const value = typeof source[id] === "object" ? source[id].stock : source[id];
        if (Number.isFinite(Number(value))) next[id] = Math.max(0, Number(value));
      });
      if (Object.keys(next).length) setStock(next);
    }).catch(() => {});
    return () => controller.abort();
  }, [apiBase, setStock]);

  const categories: { id: StoreCategory | "all", name: { en: string, ar: string } }[] = [
    { id: "all", name: { en: "All", ar: "الكل" } },
    { id: "electrical", name: { en: "Electrical Essentials", ar: "مستلزمات كهربائية" } },
    { id: "comfort", name: { en: "Travel Comfort", ar: "راحة السفر" } },
    { id: "bags", name: { en: "Bags & Packages", ar: "حقائب وبكجات" } },
  ];

  const filteredProducts = activeCategory === "all" 
    ? catalog
    : catalog.filter(p => p.category === activeCategory);
  const openWhatsApp = () => {
    const message = rtl
      ? "مرحباً، أبحث عن منتج خاص لتجهيز السفر."
      : "Hello, I am looking for a special travel preparation item.";
    void Linking.openURL(`https://wa.me/96590087797?text=${encodeURIComponent(message)}`);
  };

  const renderProduct = ({ item }: { item: StoreProduct }) => (
    <View style={styles.productCard}>
      <Image source={item.imageUrl ? { uri: item.imageUrl } : item.image} style={styles.productImg} resizeMode="cover" />
      <View style={styles.productBody}>
        <Text style={[styles.productName, rtl && styles.rtlText]} numberOfLines={2}>
          {item.name[lang]}
        </Text>
        <Text style={[styles.productDesc, rtl && styles.rtlText]} numberOfLines={expandedProductId === item.id ? undefined : 3}>
          {item.desc[lang]}
        </Text>
        {item.desc[lang].length > 70 && (
          <Pressable onPress={() => setExpandedProductId(current => current === item.id ? null : item.id)} accessibilityRole="button">
            <Text style={[styles.detailsLink, rtl && styles.rtlText]}>
              {expandedProductId === item.id
                ? (rtl ? "عرض أقل" : "Show less")
                : (rtl ? "عرض تفاصيل المنتج" : "View product details")}
            </Text>
          </Pressable>
        )}
        {expandedProductId === item.id && (
          <View style={styles.purchaseInfo}>
            <Text style={[styles.purchaseInfoText, rtl && styles.rtlText]}>
              {rtl
                ? "السعر والمخزون موضحان قبل الدفع. يمكن طلب الاسترجاع خلال 14 يوماً إذا كان المنتج غير مستخدم وكاملاً وفي تغليفه الأصلي، مع مراعاة الاستثناءات الموضحة في شروط خدمة تجهيز المسافر."
                : "Price and stock are shown before payment. Returns may be requested within 14 days when the item is unused, complete, and in its original packaging, subject to the exceptions in the Travel Prep Service Terms."}
            </Text>
          </View>
        )}
        {__DEV__ && stockByProductId[item.id] !== undefined && (
          <Text style={[styles.stockText, rtl && styles.rtlText, stockByProductId[item.id] === 0 && styles.outOfStockText]}>
            {stockByProductId[item.id] > 0
              ? (rtl ? `متوفر: ${stockByProductId[item.id]}` : `In stock: ${stockByProductId[item.id]}`)
              : (rtl ? "نفد المخزون" : "Out of stock")}
          </Text>
        )}
        <View style={[styles.productBottom, rtl && { flexDirection: "row-reverse" }]}>
          <Text style={styles.productPrice}>KWD {item.priceKwd.toFixed(3)}</Text>
          {(() => {
            const quantity = items.find(cartItem => cartItem.productId === item.id)?.quantity ?? 0;
            const available = stockByProductId[item.id];
            if (quantity === 0) {
              return (
                <Pressable
                  disabled={__DEV__ && available === 0}
                  style={({pressed}) => [styles.addBtn, __DEV__ && available === 0 && styles.disabledBtn, pressed && { opacity: 0.8 }]}
                  onPress={() => addToCart(item.id)}
                  accessibilityLabel={rtl ? `إضافة ${item.name.ar}` : `Add ${item.name.en}`}
                >
                  <HotelPortalIcon name="plus" size={20} color="#FFF" />
                </Pressable>
              );
            }
            return (
              <View style={[styles.quantityControl, rtl && { flexDirection: "row-reverse" }]}>
                <Pressable style={styles.quantityButton} onPress={() => updateQuantity(item.id, quantity - 1)} accessibilityLabel={rtl ? "تقليل الكمية" : "Decrease quantity"}>
                  <HotelPortalIcon name="minus" size={17} color={C.navy} />
                </Pressable>
                <View style={styles.quantityValue}>
                  <Text style={styles.quantityText}>{quantity}</Text>
                </View>
                <Pressable
                  style={[styles.quantityButton, available !== undefined && quantity >= available && styles.quantityButtonDisabled]}
                  disabled={available !== undefined && quantity >= available}
                  onPress={() => updateQuantity(item.id, quantity + 1)}
                  accessibilityLabel={rtl ? "زيادة الكمية" : "Increase quantity"}
                >
                  <HotelPortalIcon name="plus" size={17} color={available !== undefined && quantity >= available ? "#94A3B8" : C.navy} />
                </Pressable>
              </View>
            );
          })()}
        </View>
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: Math.max(insets.top, 20) }]}>
      <View style={[styles.headerRow, rtl && { flexDirection: "row-reverse" }]}>
        <Pressable onPress={onClose} style={styles.iconBtn}>
          <HotelPortalIcon name={rtl ? "arrow-forward" : "arrow-back"} size={24} color={C.navy} />
        </Pressable>
        <Text style={styles.headerTitle}>{rtl ? "خدمة تجهيز المسافر" : "Traveler Preparation Service"}</Text>
        <Pressable onPress={onOpenCart} style={styles.iconBtn}>
          <HotelPortalIcon name="cart" size={24} color={C.navy} />
          {totalItems > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{totalItems}</Text>
            </View>
          )}
        </Pressable>
      </View>

      <View style={styles.filterScroll}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={categories}
          keyExtractor={c => c.id}
          inverted={rtl}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
          renderItem={({ item }) => (
            <Pressable
              style={[styles.filterChip, activeCategory === item.id && styles.filterChipActive]}
              onPress={() => setActiveCategory(item.id)}
            >
              <Text style={[styles.filterText, activeCategory === item.id && styles.filterTextActive]}>
                {item.name[lang]}
              </Text>
            </Pressable>
          )}
        />
      </View>

      <FlatList
        data={filteredProducts}
        keyExtractor={p => p.id}
        renderItem={renderProduct}
        contentContainerStyle={[
          styles.listContent,
          filteredProducts.length === 0 && styles.emptyListContent,
          { paddingBottom: insets.bottom + 20 },
        ]}
        ListEmptyComponent={
          catalog.length === 0 ? (
            <View style={styles.emptyCard}>
              <View style={styles.emptyIcon}>
                <HotelPortalIcon name="cart" size={28} color="#FFFFFF" />
              </View>
              <Text style={[styles.emptyTitle, rtl && styles.rtlText]}>
                {rtl ? "منتجاتنا قيد التجهيز" : "Our collection is being prepared"}
              </Text>
              <Text style={[styles.emptyMessage, rtl && styles.rtlText]}>
                {rtl
                  ? "لا توجد منتجات متاحة حالياً. إذا كنت تبحث عن منتج خاص لتجهيز سفرك، يسعد فريقنا بمساعدتك."
                  : "There are no items available at the moment. If you need a special item for your trip, our team will be happy to assist you."}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={rtl ? "تواصل معنا عبر واتساب" : "Contact us on WhatsApp"}
                onPress={openWhatsApp}
                style={({ pressed }) => [styles.whatsAppButton, pressed && styles.buttonPressed]}
              >
                <WhatsAppIcon size={20} color={C.whatsAppDark} markColor="#FFFFFF" />
                <Text style={styles.whatsAppButtonText}>
                  {rtl ? "تواصل معنا عبر واتساب" : "Contact us on WhatsApp"}
                </Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.categoryEmpty}>
              <Text style={[styles.categoryEmptyText, rtl && styles.rtlText]}>
                {rtl ? "لا توجد منتجات في هذه الفئة حالياً." : "No items are available in this category right now."}
              </Text>
            </View>
          )
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.canvasAlt },
  headerRow: { 
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 12,
  },
  iconBtn: { padding: 12 },
  headerTitle: { fontSize: 20, fontWeight: "800", color: C.navy },
  badge: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "#16803C",
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: "#FFF", fontSize: 11, fontWeight: "bold" },
  filterScroll: { marginBottom: 12, height: 40 },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#FFF",
    borderWidth: 1,
    borderColor: "rgba(0,53,128,0.1)",
    justifyContent: "center",
  },
  filterChipActive: { backgroundColor: C.navy },
  filterText: { color: C.navy, fontSize: 14, fontWeight: "600" },
  filterTextActive: { color: "#FFF" },
  listContent: { paddingHorizontal: 16, gap: 16 },
  emptyListContent: { flexGrow: 1, justifyContent: "center" },
  emptyCard: {
    alignItems: "center",
    alignSelf: "center",
    width: "100%",
    maxWidth: 390,
    backgroundColor: C.canvas,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.borderOnLight,
    paddingHorizontal: 26,
    paddingVertical: 30,
    shadowColor: C.navy,
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.navy,
    marginBottom: 18,
  },
  emptyTitle: {
    color: C.navy,
    fontSize: 20,
    lineHeight: 27,
    fontWeight: "800",
    textAlign: "center",
  },
  emptyMessage: {
    color: C.mutedOnLight,
    fontSize: 14,
    lineHeight: 22,
    textAlign: "center",
    marginTop: 9,
    marginBottom: 22,
  },
  whatsAppButton: {
    minHeight: 44,
    alignSelf: "center",
    borderRadius: 22,
    borderWidth: 2,
    borderColor: C.whatsAppDark,
    backgroundColor: C.whatsAppLight,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    paddingHorizontal: 22,
  },
  whatsAppButtonText: { color: C.whatsAppDark, fontSize: 14, fontWeight: "800" },
  buttonPressed: { opacity: 0.84 },
  categoryEmpty: { alignItems: "center", padding: 28 },
  categoryEmptyText: { color: C.mutedOnLight, fontSize: 14, textAlign: "center" },
  productCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: C.navy,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  productImg: { width: "100%", height: 180, backgroundColor: "#E2E8F0" },
  productBody: { padding: 16 },
  productName: { fontSize: 16, fontWeight: "800", color: C.navy, marginBottom: 4 },
  productDesc: { fontSize: 13, color: "#64748B", marginBottom: 12 },
  detailsLink: { color: C.navy, fontSize: 12, fontWeight: "800", textDecorationLine: "underline", marginTop: -5, marginBottom: 10 },
  purchaseInfo: { backgroundColor: "#F4F8F5", borderLeftWidth: 3, borderLeftColor: "#16803C", borderRadius: 7, padding: 9, marginBottom: 10 },
  purchaseInfoText: { color: "#475569", fontSize: 11, lineHeight: 17 },
  stockText: { fontSize: 12, color: "#15803D", fontWeight: "700", marginBottom: 8 },
  outOfStockText: { color: "#B91C1C" },
  disabledBtn: { backgroundColor: "#94A3B8" },
  rtlText: { textAlign: "right", writingDirection: "rtl" },
  productBottom: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  productPrice: { fontSize: 16, fontWeight: "900", color: C.navy },
  addBtn: {
    backgroundColor: C.navy,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  quantityControl: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#D8E0EC", borderRadius: 18, overflow: "hidden", backgroundColor: "#FFF" },
  quantityButton: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  quantityButtonDisabled: { backgroundColor: "#F1F5F9" },
  quantityValue: { minWidth: 34, height: 34, alignItems: "center", justifyContent: "center", backgroundColor: "#16803C" },
  quantityText: { color: "#FFF", fontSize: 14, fontWeight: "900" },
});
