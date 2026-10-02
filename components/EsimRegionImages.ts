import type { ImageSourcePropType } from "react-native";

// Downloaded from the supplier's destination images and recolored to match
// the eSIM cards. Keep these bundled so the maps also appear offline.
const regionImages: Record<string, ImageSourcePropType> = {
  "eu-plus-uk": require("../assets/esim-regions/eu-plus-uk.png"),
  europe: require("../assets/esim-regions/europe.png"),
  asia: require("../assets/esim-regions/asia.png"),
  africa: require("../assets/esim-regions/africa.png"),
  "caribbean-islands": require("../assets/esim-regions/caribbean-islands.png"),
  "latin-america": require("../assets/esim-regions/latin-america.png"),
  "middle-east-and-north-africa": require("../assets/esim-regions/middle-east-and-north-africa.png"),
  "north-america": require("../assets/esim-regions/north-america.png"),
  oceania: require("../assets/esim-regions/oceania.png"),
  "africa-safari": require("../assets/esim-regions/africa-safari.png"),
  world: require("../assets/esim-regions/world.png"),
};

export function getEsimRegionImage(slug: string): ImageSourcePropType | undefined {
  return Object.prototype.hasOwnProperty.call(regionImages, slug) ? regionImages[slug] : undefined;
}