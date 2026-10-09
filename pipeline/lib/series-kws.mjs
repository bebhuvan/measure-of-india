// pipeline/lib/series-kws.mjs — THE series keyword maps: which words in a
// sentence refer to which series of the dossier's CURRENT bundle. One map,
// three consumers: pipeline/verify.mjs (claim checks + the negative guard),
// pipeline/contract.mjs (coverage floors), pipeline/generate.mjs (the
// COVERAGE enumeration). A series with no keyword cannot be covered, so the
// maps must name every series of the current bundle — a map that lags the
// bundle is a coverage hole, and contract.mjs fails a floor it cannot see.
//
// Order matters: resolveSeries returns the FIRST keyword that matches, so
// specific phrases precede generic ones ("food index" before "food").

export const SERIES_KWS = {
  cpi: [
    ["headline", "headline"], ["inflation", "headline"],
    ["food", "food_and_beverages"],
    ["tobacco", "paan_tobacco_and_intoxicants"], ["paan", "paan_tobacco_and_intoxicants"], ["intoxicants", "paan_tobacco_and_intoxicants"], ["pan masala", "paan_tobacco_and_intoxicants"],
    ["clothing", "clothing_and_footwear"], ["footwear", "clothing_and_footwear"], ["apparel", "clothing_and_footwear"],
    ["housing", "housing_water_electricity_gas_and_other_fuels"], ["utilities", "housing_water_electricity_gas_and_other_fuels"], ["electricity", "housing_water_electricity_gas_and_other_fuels"], ["fuel and light", "housing_water_electricity_gas_and_other_fuels"],
    ["furnishings", "furnishings_household_equipment_and_routine_household_maintenance"], ["furniture", "furnishings_household_equipment_and_routine_household_maintenance"], ["household equipment", "furnishings_household_equipment_and_routine_household_maintenance"],
    ["health", "health"],
    ["transport", "transport"],
    ["information", "information_and_communication"], ["communication", "information_and_communication"],
    ["recreation", "recreation_sport_and_culture"], ["culture", "recreation_sport_and_culture"], ["sport", "recreation_sport_and_culture"],
    ["education", "education_services"],
    ["restaurants", "restaurants_and_accommodation_services"], ["hotels", "restaurants_and_accommodation_services"], ["accommodation", "restaurants_and_accommodation_services"],
    ["personal care", "personal_care_social_protection_and_miscellaneous_goods_and_services"], ["gold", "personal_care_social_protection_and_miscellaneous_goods_and_services"], ["miscellaneous", "personal_care_social_protection_and_miscellaneous_goods_and_services"],
  ],
  gdp: [
    ["gva", "gva"], ["consumption", "pfce"], ["pfce", "pfce"],
    ["investment", "gfcf"], ["gfcf", "gfcf"], ["capex", "gfcf"],
    ["gdp", "gdp"], ["growth", "gdp"],
  ],
  wpi: [
    ["headline", "headline"], ["wholesale", "headline"], ["inflation", "headline"],
    ["primary", "primary"],
    ["fuel", "fuel"], ["fuel and power", "fuel"],
    ["manufactured", "manufactured"],
    ["food index", "food_index"], ["food", "food_index"],
  ],
  iip: [
    ["general", "general"], ["headline", "general"], ["industrial", "general"], ["index", "general"],
    ["manufacturing", "sector_manufacturing"],
    ["mining", "sector_mining_quarrying"], ["quarrying", "sector_mining_quarrying"],
    ["electricity", "sector_electricity_gas_supply"], ["power", "sector_electricity_gas_supply"],
    ["water", "sector_water_supply_sewerage_waste_management"], ["sewerage", "sector_water_supply_sewerage_waste_management"],
    ["capital goods", "use_capital_goods"], ["capital", "use_capital_goods"],
    ["consumer durables", "use_consumer_durables"], ["durables", "use_consumer_durables"],
    ["non-durables", "use_consumer_non_durables"], ["consumer non", "use_consumer_non_durables"],
    ["infrastructure", "use_infrastructure_construction_goods"], ["construction goods", "use_infrastructure_construction_goods"],
    ["intermediate", "use_intermediate_goods"],
    ["primary goods", "use_primary_goods"], ["basic goods", "use_primary_goods"],
  ],
  jobs: [
    ["unemployment", "ur"], ["headline", "ur"], ["ur", "ur"],
    ["participation", "lfpr"], ["lfpr", "lfpr"],
    ["worker", "wpr"], ["wpr", "wpr"], ["employment", "wpr"],
  ],
  consumption: [
    ["rural", "rural"], ["mpce", "rural"], ["spending", "rural"], ["consumption", "rural"],
    ["urban", "urban"],
    ["imputed", "rural_imputed"], ["imputation", "rural_imputed"],
    ["gini", "rural"],
  ],
  factories: [
    ["factories in operation", "factories_in_operation"], ["operating factories", "factories_in_operation"], ["factories", "factories_in_operation"],
    ["gva", "gva"], ["value added", "gva"],
    ["output", "total_output"],
    ["emoluments", "emoluments"], ["wages", "emoluments"],
    ["persons engaged", "persons_engaged"], ["workers", "workers"], ["employment", "workers"],
    ["fixed capital", "fixed_capital"],
    ["invested capital", "invested_capital"],
    ["inputs", "total_inputs"],
    ["net value added", "net_value_added"],
    ["number of factories", "number_of_factories"],
  ],
  // ---- bis family session ----
  debt: [
    ["all borrowers", "total"], ["total debt", "total"], ["non-financial", "total"], ["overall", "total"],
    ["from banks", "private_banks"], ["bank credit", "private_banks"], ["banks", "private_banks"],
    ["households", "households"], ["household", "households"], ["families", "households"],
    ["companies", "companies"], ["corporate", "companies"], ["firms", "companies"], ["businesses", "companies"],
    ["government", "government"], ["public debt", "government"],
    ["private", "private"],
  ],
  housing: [
    ["real index", "real"], ["real prices", "real_yoy"], ["after inflation", "real_yoy"], ["inflation-adjusted", "real_yoy"], ["real", "real_yoy"],
    ["nominal index", "nominal"], ["rupee prices", "nominal_yoy"], ["nominal", "nominal_yoy"],
  ],
  // services: the current bundle is services-gva-2022-share (shares of GVA by industry)
  services: [
    ["trade, hotels, transport", "trade_transport_comm"], ["trade, hotels and transport", "trade_transport_comm"], ["trade and transport", "trade_transport_comm"],
    ["finance, real estate", "finance_realty_prof"], ["finance and real estate", "finance_realty_prof"], ["financial, real estate", "finance_realty_prof"],
    ["public administration, defence and other", "public_admin_other"], ["public administration and other", "public_admin_other"],
    ["trade and repair", "trade_repair"], ["trade, repair", "trade_hotels"], ["hotels and restaurants", "hotels_restaurants"], ["hotels", "hotels_restaurants"], ["restaurants", "hotels_restaurants"],
    ["transport, storage", "transport_comm"], ["railways", "railways"], ["road transport", "road_transport"], ["water transport", "water_transport"], ["air transport", "air_transport"], ["airlines", "air_transport"],
    ["incidental to transport", "transport_services"], ["storage", "storage"], ["communication", "communication"], ["broadcasting", "communication"],
    ["real estate", "realty_prof"], ["dwellings", "realty_prof"], ["professional", "realty_prof"], ["financial services", "finance"], ["finance", "finance"],
    ["public administration", "public_admin"], ["defence", "public_admin"], ["other services", "other_services"],
    ["farms, mines", "goods"], ["goods", "goods"], ["agriculture", "agriculture"], ["farming", "agriculture"], ["mining", "mining"], ["manufacturing", "manufacturing"],
    ["utilities", "utilities"], ["electricity", "utilities"], ["construction", "construction"],
    ["services", "services"], ["service", "services"],
  ],
  // --- states (state economies): the fixed-panel spread bundle, states-spread ---
  states: [
    ["at constant prices", "gap_constant"], ["constant prices", "gap_constant"],
    ["times", "gap_current"], ["multiple", "gap_current"], ["gap", "gap_current"],
    ["spread", "cv_constant"], ["coefficient of variation", "cv_constant"], ["dispersion", "cv_constant"],
    ["richest", "richest_current"], ["poorest", "poorest_current"],
    ["middle state", "median_current"], ["median", "median_current"],
    ["real growth", "median_real_growth"], ["grew", "median_real_growth"], ["growth", "median_real_growth"],
  ],
};
