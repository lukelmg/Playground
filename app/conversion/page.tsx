"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import * as math from 'mathjs';
import { Button } from "@/components/ui/button";

interface Result {
  value: string;
  inMeters: string | null;
  dimensionalAnalysis: {
    numericValue: number | null;
    units: string | null;
    error: string | null;
  };
}

interface UnitDefinition {
  name: string;
  base: {
    key: string;
  };
  prefixes?: string[];
}

interface DerivedUnit {
  name: string;
  definition: string;
  conversions: {
    unit: string;
    value: string;
  }[];
}

interface UnitConversion {
  baseType: string;
  power: number;
  conversions: {
    unit: string;
    value: string;
  }[];
  derivedUnits?: DerivedUnit[];
}

interface SelectedUnit {
  baseType: string;
  unit: string;
  power: number;
}

export default function ConversionPage() {
  const defaultValue = "x=2N/m^2";
  const [value, setValue] = React.useState<string>(defaultValue);
  const [result, setResult] = React.useState<Result>({
    value: "",
    inMeters: null,
    dimensionalAnalysis: {
      numericValue: null,
      units: null,
      error: null
    }
  });
  const [conversions, setConversions] = React.useState<UnitConversion[]>([]);
  const [selectedUnits, setSelectedUnits] = React.useState<SelectedUnit[]>([]);

  React.useEffect(() => {
    evaluateExpression(defaultValue);
  }, []);

  const getCompatibleUnits = (baseType: string) => {
    return Object.entries(math.Unit.UNITS)
      .filter(([, def]) => (def as unknown as UnitDefinition).base?.key === baseType)
      .map(([unitName]) => unitName);
  };

  const removeDuplicateConversions = (conversions: { unit: string; value: string; }[]) => {
    // Group conversions by their numerical value
    const valueGroups = new Map<string, { unit: string; value: string; }[]>();
    
    conversions.forEach(conv => {
      // Extract just the numerical part for comparison
      const numericValue = conv.value.split(' ')[0];
      if (!valueGroups.has(numericValue)) {
        valueGroups.set(numericValue, []);
      }
      valueGroups.get(numericValue)?.push(conv);
    });

    // For each group, keep only the conversion with the longest unit name
    return Array.from(valueGroups.values()).map(group => 
      group.reduce((longest, current) => 
        current.unit.length > longest.unit.length ? current : longest
      )
    );
  };

  const findDerivedUnits = (evaluated: math.Unit) => {
    const derivedUnits: DerivedUnit[] = [];
    
    // Get the numerical value and base units of the evaluated unit
    const baseUnitString = evaluated.toString();
    const [, unitPart] = baseUnitString.split(' ');
    
    // Function to normalize unit string for comparison
    const normalizeUnitString = (str: string) => {
      try {
        // Convert to a unit and back to get standardized form
        const unit = math.unit(str);
        const baseForm = unit.toString().split(' ')[1];
        // Split into components, sort them, and rejoin
        return baseForm.split('*')
          .map(part => part.trim())
          .sort()
          .join('*');
      } catch {
        return str;
      }
    };

    // Function to check if two units are equivalent
    const areUnitsEquivalent = (unit1: string, unit2: string) => {
      try {
        // Create test units with value 1
        const test1 = math.unit(unit1);
        const test2 = math.unit(unit2);
        
        // Try converting between them (in both directions)
        try {
          test1.to(test2.units[0].unit.name);
          return true;
        } catch {
          try {
            test2.to(test1.units[0].unit.name);
            return true;
          } catch {
            // If direct conversion fails, compare normalized base units
            const base1 = normalizeUnitString(test1.toString().split(' ')[1]);
            const base2 = normalizeUnitString(test2.toString().split(' ')[1]);
            return base1 === base2;
          }
        }
      } catch {
        return false;
      }
    };

    // Find all equivalent units
    const equivalentUnits = new Set<string>();
    
    // Check all units in mathjs
    Object.entries(math.Unit.UNITS).forEach(([unitName]) => {
      try {
        // Skip dimensionless units and basic units
        if (unitName === '' || unitName.includes('1')) return;
        
        // Create a test unit of 1 of the current unit
        const testUnit = math.unit(`1 ${unitName}`);
        const testBaseString = testUnit.toString();
        const [, testUnitPart] = testBaseString.split(' ');
        
        // Check if units are equivalent (considering different arrangements)
        if (areUnitsEquivalent(`1 ${unitPart}`, `1 ${testUnitPart}`)) {
          equivalentUnits.add(unitName);
        }
      } catch {
        // Skip units that can't be converted
      }
    });

    // Find the main derived unit based on unit structure and simplicity
    const mainUnit = Array.from(equivalentUnits)
      .sort((a, b) => {
        // Prefer units with shorter names (typically more fundamental)
        const lengthDiff = a.length - b.length;
        if (lengthDiff !== 0) return lengthDiff;
        
        // If lengths are equal, sort alphabetically for consistency
        return a.localeCompare(b);
      })[0];

    if (mainUnit) {
      try {
        // Get all compatible conversions for this derived unit
        const directConversions = getCompatibleUnits(mainUnit).map(compatibleUnit => {
          try {
            const converted = math.unit(`1 ${mainUnit}`).to(compatibleUnit);
            return {
              unit: compatibleUnit,
              value: converted.toString()
            };
          } catch {
            return null;
          }
        }).filter((conv): conv is { unit: string; value: string } => conv !== null);

        // Get equivalent derived units
        const equivalentConversions = Array.from(equivalentUnits)
          .filter(unit => unit !== mainUnit)
          .map(unit => {
            try {
              const converted = math.unit(`1 ${mainUnit}`).to(unit);
              return {
                unit,
                value: converted.toString()
              };
            } catch {
              return null;
            }
          })
          .filter((conv): conv is { unit: string; value: string } => conv !== null);

        // Combine all conversions
        const allConversions = [...directConversions, ...equivalentConversions];

        // Get the definition in base units
        const definition = math.unit(`1 ${mainUnit}`).toString();

        if (allConversions.length > 0) {
          derivedUnits.push({
            name: mainUnit,
            definition: definition,
            conversions: removeDuplicateConversions(allConversions)
          });
        }
      } catch {
        // Skip if unable to convert
      }
    }

    return derivedUnits;
  };

  const getConversions = (evaluated: math.Unit | string | number) => {
    try {
      const unit = typeof evaluated === 'string' || typeof evaluated === 'number'
        ? math.unit(evaluated.toString())
        : evaluated;

      if (!unit || typeof unit.toNumber !== 'function') {
        return []; // Not a unit
      }

      const units = unit.units;
      const results: UnitConversion[] = [];
      
      if (units.length > 0) {
        const seenBaseTypes = new Set<string>();
        
        units.forEach(unitPart => {
          const baseKey = unitPart.unit.base.key;
          if (!seenBaseTypes.has(baseKey)) {
            seenBaseTypes.add(baseKey);
            
            const compatibleUnits = getCompatibleUnits(baseKey);
            const conversions: { unit: string; value: string; }[] = [];
            
            try {
              const testUnit = math.unit('1 ' + unitPart.unit.name);
              
              compatibleUnits.forEach(compatibleUnit => {
                try {
                  const converted = testUnit.to(compatibleUnit);
                  conversions.push({
                    unit: compatibleUnit,
                    value: converted.toString()
                  });
                } catch {
                  // Skip incompatible units
                }
              });

              // Remove duplicates before adding to results
              const uniqueConversions = removeDuplicateConversions(conversions);

              results.push({
                baseType: baseKey,
                power: unitPart.power,
                conversions: uniqueConversions
              });
            } catch {
              // Skip if unable to convert
            }
          }
        });

        // Add derived units to the first conversion result
        if (results.length > 0) {
          const derivedUnits = findDerivedUnits(unit);
          if (derivedUnits.length > 0) {
            results[0].derivedUnits = derivedUnits;
          }
        }
      }
      
      return results;
    } catch {
      return []; // Not a unit
    }
  };

  const getConversionFactor = (fromUnit: string, toUnit: string): number => {
    try {
      // Handle special case for pressure unit components
      if (fromUnit.endsWith("_force")) {
        // Convert from pressure to force (multiply by area)
        const pressureToForce = math.unit('1 Pa').to('N/m^2').toNumber() * 1; // 1 m^2 area
        // Then convert force to target unit
        const forceUnit = math.unit('1 N').to(toUnit);
        return pressureToForce * forceUnit.toNumber();
      } else if (fromUnit.endsWith("_length")) {
        // For length component, we use meter as the base unit
        return math.unit('1 m').to(toUnit).toNumber();
      } else if (fromUnit.endsWith("_mass")) {
        // For mass component of energy, we use kilogram as base unit
        return math.unit('1 kg').to(toUnit).toNumber();
      } else if (fromUnit.endsWith("_time")) {
        // For time component of energy, we use second as base unit
        return math.unit('1 s').to(toUnit).toNumber();
      }

      // Create a unit with value 1 in the fromUnit
      const testUnit = math.unit('1 ' + fromUnit);
      // Convert to target unit and extract the numeric value
      const converted = testUnit.to(toUnit);
      return converted.toNumber();
    } catch (error) {
      console.error('Error getting conversion factor:', { fromUnit, toUnit, error });
      throw new Error(`Cannot get conversion factor from ${fromUnit} to ${toUnit}`);
    }
  };

  const getDimensionalExpression = (units: SelectedUnit[] = selectedUnits) => {
    if (units.length === 0) return "No units selected";
    
    // Sort units by baseType to ensure consistent ordering
    const sortedUnits = [...units].sort((a, b) => a.baseType.localeCompare(b.baseType));
    
    // Group units by whether they are in numerator (positive power) or denominator (negative power)
    const numerator = sortedUnits.filter(u => u.power > 0);
    const denominator = sortedUnits.filter(u => u.power < 0);
    
    // Format numerator
    const numeratorStr = numerator
      .map(u => u.power === 1 ? u.unit : `${u.unit}^${u.power}`)
      .join(' * ');
    
    // Format denominator
    const denominatorStr = denominator
      .map(u => `${u.unit}^${Math.abs(u.power)}`)
      .join(' * ');
    
    // Combine numerator and denominator
    let result;
    if (numeratorStr && denominatorStr) {
      result = `(${numeratorStr}) / (${denominatorStr})`;
    } else if (numeratorStr) {
      result = numeratorStr;
    } else if (denominatorStr) {
      result = `1 / (${denominatorStr})`;
    } else {
      result = "No units selected";
    }
    
    return result;
  };

  const calculateDimensionalAnalysis = (evaluated: math.Unit, selectedUnits: SelectedUnit[]): Result['dimensionalAnalysis'] => {
    if (selectedUnits.length === 0) {
      return { numericValue: null, units: null, error: null };
    }

    try {
      // Create a map of base types to their selected units for easy lookup
      const selectedUnitMap = new Map(selectedUnits.map(u => [u.baseType, u]));
      
      // Get the original value and units
      const originalValue = evaluated.toNumber();
      const originalUnits = evaluated.units;

      // Calculate the conversion factor for each unit component
      let finalValue = originalValue;
      const convertedUnits = new Set<string>();

      // First, verify that we have all necessary units selected
      console.log('Original units:', originalUnits);
      for (const originalUnit of originalUnits) {
        const baseType = originalUnit.unit.base.key;
        if (baseType === "PRESSURE") {
          // For pressure units, we need to split into force and area (length squared)
          // Add force component
          const forceUnit = selectedUnitMap.get("FORCE");
          if (forceUnit) {
            try {
              // Convert the pressure unit's force component
              const forceConversionFactor = getConversionFactor(originalUnit.unit.name + "_force", forceUnit.unit);
              finalValue *= Math.pow(forceConversionFactor, originalUnit.power);
              convertedUnits.add("FORCE");
            } catch (error) {
              console.error('Force conversion error:', error);
            }
          }

          // Add length component (squared for area)
          const lengthUnit = selectedUnitMap.get("LENGTH");
          if (lengthUnit) {
            try {
              // Convert the pressure unit's length component (squared)
              const lengthConversionFactor = getConversionFactor(originalUnit.unit.name + "_length", lengthUnit.unit);
              // Note: pressure is force per area, so length is squared and negative
              finalValue *= Math.pow(lengthConversionFactor, -2 * originalUnit.power);
              convertedUnits.add("LENGTH");
            } catch (error) {
              console.error('Length conversion error:', error);
            }
          }
        } else if (baseType === "ENERGY") {
          // For energy units (E = m * l^2 * t^-2)
          // Add mass component
          const massUnit = selectedUnitMap.get("MASS");
          if (massUnit) {
            try {
              const massConversionFactor = getConversionFactor(originalUnit.unit.name + "_mass", massUnit.unit);
              finalValue *= Math.pow(massConversionFactor, originalUnit.power);
              convertedUnits.add("MASS");
            } catch (error) {
              console.error('Mass conversion error:', error);
            }
          }

          // Add length component (squared)
          const lengthUnit = selectedUnitMap.get("LENGTH");
          if (lengthUnit) {
            try {
              const lengthConversionFactor = getConversionFactor(originalUnit.unit.name + "_length", lengthUnit.unit);
              finalValue *= Math.pow(lengthConversionFactor, 2 * originalUnit.power);
              convertedUnits.add("LENGTH");
            } catch (error) {
              console.error('Length conversion error:', error);
            }
          }

          // Add time component (squared, negative)
          const timeUnit = selectedUnitMap.get("TIME");
          if (timeUnit) {
            try {
              const timeConversionFactor = getConversionFactor(originalUnit.unit.name + "_time", timeUnit.unit);
              finalValue *= Math.pow(timeConversionFactor, -2 * originalUnit.power);
              convertedUnits.add("TIME");
            } catch (error) {
              console.error('Time conversion error:', error);
            }
          }
        } else if (baseType === "POWER") {
          // For power units (P = m * l^2 * t^-3)
          // Add mass component
          const massUnit = selectedUnitMap.get("MASS");
          if (massUnit) {
            try {
              const massConversionFactor = getConversionFactor(originalUnit.unit.name + "_mass", massUnit.unit);
              finalValue *= Math.pow(massConversionFactor, originalUnit.power);
              convertedUnits.add("MASS");
            } catch (error) {
              console.error('Mass conversion error:', error);
            }
          }

          // Add length component (squared)
          const lengthUnit = selectedUnitMap.get("LENGTH");
          if (lengthUnit) {
            try {
              const lengthConversionFactor = getConversionFactor(originalUnit.unit.name + "_length", lengthUnit.unit);
              finalValue *= Math.pow(lengthConversionFactor, 2 * originalUnit.power);
              convertedUnits.add("LENGTH");
            } catch (error) {
              console.error('Length conversion error:', error);
            }
          }

          // Add time component (cubed, negative)
          const timeUnit = selectedUnitMap.get("TIME");
          if (timeUnit) {
            try {
              const timeConversionFactor = getConversionFactor(originalUnit.unit.name + "_time", timeUnit.unit);
              finalValue *= Math.pow(timeConversionFactor, -3 * originalUnit.power); // Note: t^-3 for power
              convertedUnits.add("TIME");
            } catch (error) {
              console.error('Time conversion error:', error);
            }
          }
        } else if (baseType === "SURFACE" || baseType === "AREA") {
          // For area units (A = l^2)
          const lengthUnit = selectedUnitMap.get("LENGTH");
          if (lengthUnit) {
            try {
              const lengthConversionFactor = getConversionFactor(originalUnit.unit.name + "_length", lengthUnit.unit);
              finalValue *= Math.pow(lengthConversionFactor, 2 * originalUnit.power); // l^2 for area
              convertedUnits.add("LENGTH");
            } catch (error) {
              console.error('Length conversion error:', error);
            }
          }
        } else if (baseType === "VOLUME") {
          // For volume units (V = l^3)
          const lengthUnit = selectedUnitMap.get("LENGTH");
          if (lengthUnit) {
            try {
              const lengthConversionFactor = getConversionFactor(originalUnit.unit.name + "_length", lengthUnit.unit);
              finalValue *= Math.pow(lengthConversionFactor, 3 * originalUnit.power); // l^3 for volume
              convertedUnits.add("LENGTH");
            } catch (error) {
              console.error('Length conversion error:', error);
            }
          }
        } else {
          // Handle non-pressure/energy/power/area/volume units as before
          const selectedUnit = selectedUnitMap.get(baseType);
          if (!selectedUnit) continue;

          try {
            const factor = getConversionFactor(originalUnit.unit.name, selectedUnit.unit);
            finalValue *= Math.pow(factor, originalUnit.power);
            convertedUnits.add(baseType);
          } catch (error) {
            console.error('Conversion error:', error);
            return {
              numericValue: null,
              units: null,
              error: `Cannot convert ${originalUnit.unit.name} to ${selectedUnit.unit}`
            };
          }
        }
      }

      // Format the units string using the exact selected units passed to this function
      const unitsStr = getDimensionalExpression(selectedUnits);

      return {
        numericValue: finalValue,
        units: unitsStr,
        error: null
      };
    } catch (error) {
      console.error('Calculation error:', error);
      return {
        numericValue: null,
        units: null,
        error: 'Error performing dimensional analysis'
      };
    }
  };

  const evaluateExpression = (input: string) => {
    try {
      if (!input.trim()) {
        setResult({
          value: "",
          inMeters: null,
          dimensionalAnalysis: {
            numericValue: null,
            units: null,
            error: null
          }
        });
        setConversions([]);
        setSelectedUnits([]); // Clear selected units when input is empty
        return;
      }

      const evaluated = math.evaluate(input);
      let metersValue: string | null = null;
      let dimensionalAnalysis: Result['dimensionalAnalysis'] = {
        numericValue: null,
        units: null,
        error: null
      };

      // Get all possible conversions
      const newConversions = getConversions(evaluated);
      setConversions(newConversions);

      // Get the base types from the new conversions
      const currentBaseTypes = new Set(newConversions.map(conv => conv.baseType));
      
      // Filter out selected units that are no longer applicable
      setSelectedUnits(prev => prev.filter(selected => currentBaseTypes.has(selected.baseType)));

      // Try to convert to meters if it's a unit
      try {
        const inMeters = math.unit(evaluated);
        metersValue = inMeters.toString();
        
        // Always calculate dimensional analysis with current selected units
        dimensionalAnalysis = calculateDimensionalAnalysis(inMeters, selectedUnits);
      } catch {
        // Not a unit or cannot be converted to meters
        metersValue = null;
      }

      setResult({
        value: evaluated.toString(),
        inMeters: metersValue,
        dimensionalAnalysis
      });
    } catch {
      setResult({
        value: "Invalid expression",
        inMeters: null,
        dimensionalAnalysis: {
          numericValue: null,
          units: null,
          error: "Invalid expression"
        }
      });
      setConversions([]);
      setSelectedUnits([]); // Clear selected units on invalid expression
    }
  };

  const handleUnitSelection = (baseType: string, unit: string, power: number) => {
    // Create new selected units array
    const newSelectedUnits = [
      ...selectedUnits.filter(u => u.baseType !== baseType),
      { baseType, unit, power }
    ];
    
    // Update selected units first
    setSelectedUnits(newSelectedUnits);
    
    // Then update the dimensional analysis result using the current expression
    try {
      if (result.value) {
        const evaluated = math.unit(result.value);
        const newDimensionalAnalysis = calculateDimensionalAnalysis(evaluated, newSelectedUnits);
        
        // Update the entire result to ensure consistency
        setResult(prev => ({
          ...prev,
          dimensionalAnalysis: newDimensionalAnalysis
        }));
      }
    } catch (error) {
      console.error('Error updating dimensional analysis:', error);
    }
  };

  return (
    <div className="p-4 flex flex-col gap-4">
      <div className="flex gap-4 items-center">
        <Input
          type="text"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            evaluateExpression(e.target.value);
          }}
          placeholder="Enter mathematical expression or unit (e.g., 5 m/s, 10 ft^3)..."
          className="max-w-sm"
        />
        <div className="min-w-[200px] p-2 border rounded-md bg-muted">
          {result.value || "Result will appear here"}
        </div>
      </div>

      {conversions.length > 0 && (
        <div className="flex flex-col gap-4 mt-4">
          <div className="text-lg font-semibold">
            Unit Conversions
          </div>
          <div className="flex flex-wrap gap-4">
            {conversions.map((conversion, i) => (
              <div key={i} className="flex-1 min-w-[200px] max-w-[400px]">
                <div className="font-medium mb-2">
                  {conversion.baseType} (power: {conversion.power})
                </div>
                <div className="space-y-2 border rounded-md p-2">
                  {conversion.conversions.map((conv, j) => (
                    <div key={j}>
                      <Button 
                        variant={selectedUnits.some(u => u.unit === conv.unit) ? "default" : "ghost"}
                        className="h-auto py-1 px-2 font-mono w-full text-left justify-start"
                        onClick={() => handleUnitSelection(conversion.baseType, conv.unit, conversion.power)}
                      >
                        {conv.unit}: {conv.value}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* New Dimensional Unit Builder Section */}
          <div className="mt-4 p-4 border rounded-md">
            <div className="text-lg font-semibold mb-2">
              Dimensional Unit Builder
            </div>
            <div className="flex flex-col gap-2">
              <div className="font-medium">Selected Units:</div>
              <div className="p-2 bg-muted rounded-md font-mono">
                {getDimensionalExpression()}
              </div>
              {result.dimensionalAnalysis && (
                <>
                  <div className="font-medium mt-2">Dimensional Analysis Result:</div>
                  <div className="p-2 bg-muted rounded-md">
                    {result.dimensionalAnalysis.error ? (
                      <div className="text-destructive">{result.dimensionalAnalysis.error}</div>
                    ) : (
                      <div className="font-mono flex gap-2 items-baseline">
                        <span className="text-lg">
                          {result.dimensionalAnalysis.numericValue?.toFixed(6)}
                        </span>
                        <span className="text-muted-foreground">
                          {result.dimensionalAnalysis.units}
                        </span>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
          
          {conversions[0]?.derivedUnits && conversions[0].derivedUnits.length > 0 && (
            <>
              <div className="w-full border-t border-border my-4" />
              <div className="text-lg font-semibold mb-2">
                Equivalent Derived Units
              </div>
              <div className="flex flex-col gap-4">
                {conversions[0].derivedUnits.map((derived, i) => (
                  <div key={i}>
                    <div className="font-medium mb-2">
                      {derived.name} ({derived.definition})
                    </div>
                    <div className="space-y-2 max-h-[400px] overflow-y-auto border rounded-md p-2">
                      {derived.conversions.map((conv, j) => (
                        <div key={j}>
                          <Button 
                            variant="ghost" 
                            className="h-auto py-1 px-2 font-mono w-full text-left justify-start"
                          >
                            {conv.unit}: {conv.value}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
