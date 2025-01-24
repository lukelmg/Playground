"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import * as math from 'mathjs';
import { Button } from "@/components/ui/button";
import { ChevronRightIcon } from "@radix-ui/react-icons";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";

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

interface LengthUnit {
  unit: string;
  value: string;
  label: string;
}

interface UnitConversionButtonProps {
  conversion: {
    unit: string;
    value: string;
  };
  baseType: string;
  power: number;
  isSelected: boolean;
  selectedUnits: SelectedUnit[];
  onSelect: (baseType: string, unit: string, power: number) => void;
}

const commonLengthUnits: LengthUnit[] = [
  { unit: 'nm', value: '1e-9', label: 'nanometers' },
  { unit: 'um', value: '1e-6', label: 'micrometers' },
  { unit: 'mm', value: '0.001', label: 'millimeters' },
  { unit: 'cm', value: '0.01', label: 'centimeters' },
  { unit: 'dm', value: '0.1', label: 'decimeters' },
  { unit: 'm', value: '1', label: 'meters' },
  { unit: 'km', value: '1000', label: 'kilometers' }
];

const commonTimeUnits: LengthUnit[] = [
  { unit: 'ns', value: '1e-9', label: 'nanoseconds' },
  { unit: 'us', value: '1e-6', label: 'microseconds' },
  { unit: 'ms', value: '0.001', label: 'milliseconds' },
  { unit: 's', value: '1', label: 'seconds' }
];

const commonMassUnits: LengthUnit[] = [
  { unit: 'ng', value: '1e-9', label: 'nanograms' },
  { unit: 'ug', value: '1e-6', label: 'micrograms' },
  { unit: 'mg', value: '0.001', label: 'milligrams' },
  { unit: 'cg', value: '0.01', label: 'centigrams' },
  { unit: 'dg', value: '0.1', label: 'decigrams' },
  { unit: 'g', value: '1', label: 'grams' },
  { unit: 'kg', value: '1000', label: 'kilograms' }
];

const UnitConversionButton: React.FC<UnitConversionButtonProps> = ({
  conversion,
  baseType,
  power,
  isSelected,
  selectedUnits,
  onSelect
}) => {
  const [showSecondary, setShowSecondary] = React.useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLDivElement>(null);
  const timeoutRef = React.useRef<NodeJS.Timeout | undefined>(undefined);

  const isLengthUnit = baseType === 'LENGTH' && (conversion.unit === 'meters' || conversion.unit === 'm');
  const isTimeUnit = baseType === 'TIME' && (conversion.unit === 'seconds' || conversion.unit === 's');
  const isMassUnit = baseType === 'MASS' && (conversion.unit === 'grams' || conversion.unit === 'g');

  // Handle clicks outside the menu to close it
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showSecondary && 
          menuRef.current && 
          buttonRef.current && 
          !menuRef.current.contains(event.target as Node) && 
          !buttonRef.current.contains(event.target as Node)) {
        setShowSecondary(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showSecondary]);

  // Cleanup timeout on unmount
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const handleMouseEnter = () => {
    if (isLengthUnit || isTimeUnit || isMassUnit) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setShowSecondary(true);
    }
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    if (isLengthUnit || isTimeUnit || isMassUnit) {
      // Check if moving to the secondary menu
      const relatedTarget = e.relatedTarget as Element | null;
      if (menuRef.current?.contains(relatedTarget) || buttonRef.current?.contains(relatedTarget)) {
        return;
      }

      // Add a small delay before closing
      timeoutRef.current = setTimeout(() => {
        setShowSecondary(false);
      }, 150);
    }
  };

  const handleButtonClick = () => {
    if (isLengthUnit || isTimeUnit || isMassUnit) {
      setShowSecondary(!showSecondary);
    } else {
      onSelect(baseType, conversion.unit, power);
    }
  };

  const handleSecondarySelect = (unit: string) => {
    onSelect(baseType, unit, power);
    setShowSecondary(false);
  };

  // Find if any metric unit is selected for this base type and power
  const hasMetricSelection = selectedUnits.some(u => 
    u.baseType === baseType && 
    u.power === power && 
    (isLengthUnit ? commonLengthUnits : isTimeUnit ? commonTimeUnits : isMassUnit ? commonMassUnits : []).some(lu => lu.unit === u.unit)
  );

  // Get the selected metric unit if any
  const selectedMetricUnit = hasMetricSelection 
    ? selectedUnits.find(u => 
        u.baseType === baseType && 
        u.power === power && 
        (isLengthUnit ? commonLengthUnits : isTimeUnit ? commonTimeUnits : isMassUnit ? commonMassUnits : []).some(lu => lu.unit === u.unit)
      )
    : null;

  return (
    <div 
      className="relative" 
      ref={buttonRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Button 
        variant={isSelected || ((isLengthUnit || isTimeUnit || isMassUnit) && hasMetricSelection) ? "default" : "ghost"}
        className={`h-auto py-1 px-2 font-mono w-full text-left justify-between transition-colors group
          ${(isLengthUnit || isTimeUnit || isMassUnit) ? 'cursor-pointer' : ''}`}
        onClick={handleButtonClick}
      >
        <span>
          {(isLengthUnit || isTimeUnit || isMassUnit) && selectedMetricUnit 
            ? `${selectedMetricUnit.unit}: ${(isLengthUnit ? commonLengthUnits : isTimeUnit ? commonTimeUnits : commonMassUnits).find(u => u.unit === selectedMetricUnit.unit)?.label}`
            : `${conversion.unit}: ${conversion.value}`}
        </span>
        {(isLengthUnit || isTimeUnit || isMassUnit) && (
          <ChevronRightIcon className="h-4 w-4 shrink-0 transition-colors opacity-50 group-hover:opacity-100" />
        )}
      </Button>
      
      {(isLengthUnit || isTimeUnit || isMassUnit) && showSecondary && (
        <div 
          ref={menuRef}
          className="absolute left-full top-0 ml-2 bg-background border rounded-md shadow-lg z-50 min-w-[200px]"
          onMouseEnter={() => {
            if (timeoutRef.current) {
              clearTimeout(timeoutRef.current);
            }
          }}
          onMouseLeave={() => setShowSecondary(false)}
        >
          <div className="py-1">
            {(isLengthUnit ? commonLengthUnits : isTimeUnit ? commonTimeUnits : commonMassUnits).map((unit, index) => {
              const isUnitSelected = selectedUnits.some(u => 
                u.baseType === baseType && 
                u.power === power && 
                u.unit === unit.unit
              );
              
              return (
                <Button
                  key={index}
                  variant={isUnitSelected ? "default" : "ghost"}
                  className={`h-auto py-2 px-3 font-mono w-full text-left justify-start
                    ${isUnitSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'}`}
                  onClick={() => handleSecondarySelect(unit.unit)}
                >
                  <span className="inline-block w-12">{unit.unit}</span>
                  <span className={isUnitSelected ? 'text-primary-foreground' : 'text-muted-foreground'}>
                    {unit.label} ({unit.value})
                  </span>
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default function ConversionPage() {
  const defaultValue = "x=2N/m^2";
  const [value, setValue] = React.useState<string>(defaultValue);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
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
            // Convert the actual evaluated value to this unit
            const converted = evaluated.to(compatibleUnit);
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
              // Convert the actual evaluated value to this unit
              const converted = evaluated.to(unit);
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
            conversions: allConversions
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
        
        // First, check if we have a compound unit that needs to be broken down
        const firstUnit = units[0];
        const baseType = firstUnit.unit.base.key;
        
        if (baseType === "PRESSURE") {
          // Add force component (N)
          try {
            const forceConversions = getCompatibleUnits("FORCE").map(compatibleUnit => {
              try {
                const testUnit = math.unit('1 N');
                const converted = testUnit.to(compatibleUnit);
                return {
                  unit: compatibleUnit,
                  value: converted.toString()
                };
              } catch {
                return null;
              }
            }).filter((conv): conv is { unit: string; value: string } => conv !== null);

            if (forceConversions.length > 0) {
              results.push({
                baseType: "FORCE",
                power: 1,
                conversions: removeDuplicateConversions(forceConversions)
              });
            }
          } catch (error) {
            console.error('Error getting force conversions:', error);
          }

          // Add length component (m) for area
          try {
            const lengthConversions = getCompatibleUnits("LENGTH").map(compatibleUnit => {
              try {
                const testUnit = math.unit('1 m');
                const converted = testUnit.to(compatibleUnit);
                return {
                  unit: compatibleUnit,
                  value: converted.toString()
                };
              } catch {
                return null;
              }
            }).filter((conv): conv is { unit: string; value: string } => conv !== null);

            if (lengthConversions.length > 0) {
              results.push({
                baseType: "LENGTH",
                power: -2, // Squared in denominator for pressure
                conversions: removeDuplicateConversions(lengthConversions)
              });
            }
          } catch (error) {
            console.error('Error getting length conversions:', error);
          }
        } else if (baseType === "ENERGY") {
          // Add mass component (kg)
          try {
            const massConversions = getCompatibleUnits("MASS").map(compatibleUnit => {
              try {
                const testUnit = math.unit('1 kg');
                const converted = testUnit.to(compatibleUnit);
                return {
                  unit: compatibleUnit,
                  value: converted.toString()
                };
              } catch {
                return null;
              }
            }).filter((conv): conv is { unit: string; value: string } => conv !== null);

            if (massConversions.length > 0) {
              results.push({
                baseType: "MASS",
                power: 1,
                conversions: removeDuplicateConversions(massConversions)
              });
            }
          } catch (error) {
            console.error('Error getting mass conversions:', error);
          }

          // Add length component (m)
          try {
            const lengthConversions = getCompatibleUnits("LENGTH").map(compatibleUnit => {
              try {
                const testUnit = math.unit('1 m');
                const converted = testUnit.to(compatibleUnit);
                return {
                  unit: compatibleUnit,
                  value: converted.toString()
                };
              } catch {
                return null;
              }
            }).filter((conv): conv is { unit: string; value: string } => conv !== null);

            if (lengthConversions.length > 0) {
              results.push({
                baseType: "LENGTH",
                power: 2, // Squared for energy
                conversions: removeDuplicateConversions(lengthConversions)
              });
            }
          } catch (error) {
            console.error('Error getting length conversions:', error);
          }

          // Add time component (s)
          try {
            const timeConversions = getCompatibleUnits("TIME").map(compatibleUnit => {
              try {
                const testUnit = math.unit('1 s');
                const converted = testUnit.to(compatibleUnit);
                return {
                  unit: compatibleUnit,
                  value: converted.toString()
                };
              } catch {
                return null;
              }
            }).filter((conv): conv is { unit: string; value: string } => conv !== null);

            if (timeConversions.length > 0) {
              results.push({
                baseType: "TIME",
                power: -2, // Squared in denominator for energy
                conversions: removeDuplicateConversions(timeConversions)
              });
            }
          } catch (error) {
            console.error('Error getting time conversions:', error);
          }
        } else if (baseType === "POWER") {
          // Add mass component (kg)
          try {
            const massConversions = getCompatibleUnits("MASS").map(compatibleUnit => {
              try {
                const testUnit = math.unit('1 kg');
                const converted = testUnit.to(compatibleUnit);
                return {
                  unit: compatibleUnit,
                  value: converted.toString()
                };
              } catch {
                return null;
              }
            }).filter((conv): conv is { unit: string; value: string } => conv !== null);

            if (massConversions.length > 0) {
              results.push({
                baseType: "MASS",
                power: 1,
                conversions: removeDuplicateConversions(massConversions)
              });
            }
          } catch (error) {
            console.error('Error getting mass conversions:', error);
          }

          // Add length component (m)
          try {
            const lengthConversions = getCompatibleUnits("LENGTH").map(compatibleUnit => {
              try {
                const testUnit = math.unit('1 m');
                const converted = testUnit.to(compatibleUnit);
                return {
                  unit: compatibleUnit,
                  value: converted.toString()
                };
              } catch {
                return null;
              }
            }).filter((conv): conv is { unit: string; value: string } => conv !== null);

            if (lengthConversions.length > 0) {
              results.push({
                baseType: "LENGTH",
                power: 2, // Squared for power
                conversions: removeDuplicateConversions(lengthConversions)
              });
            }
          } catch (error) {
            console.error('Error getting length conversions:', error);
          }

          // Add time component (s)
          try {
            const timeConversions = getCompatibleUnits("TIME").map(compatibleUnit => {
              try {
                const testUnit = math.unit('1 s');
                const converted = testUnit.to(compatibleUnit);
                return {
                  unit: compatibleUnit,
                  value: converted.toString()
                };
              } catch {
                return null;
              }
            }).filter((conv): conv is { unit: string; value: string } => conv !== null);

            if (timeConversions.length > 0) {
              results.push({
                baseType: "TIME",
                power: -3, // Cubed in denominator for power
                conversions: removeDuplicateConversions(timeConversions)
              });
            }
          } catch (error) {
            console.error('Error getting time conversions:', error);
          }
        } else {
          // Handle non-compound units as before
          units.forEach(unitPart => {
            const baseType = unitPart.unit.base.key;
            const power = unitPart.power;

            if (!seenBaseTypes.has(baseType)) {
              seenBaseTypes.add(baseType);
              
              const compatibleUnits = getCompatibleUnits(baseType);
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
                  baseType: baseType,
                  power: power,
                  conversions: uniqueConversions
                });
              } catch {
                // Skip if unable to convert
              }
            }
          });
        }

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

      // Get all possible conversions
      const newConversions = getConversions(evaluated);
      setConversions(newConversions);

      // Try to convert to meters if it's a unit
      try {
        const inMeters = math.unit(evaluated);
        metersValue = inMeters.toString();
        
        // Set initial result without dimensional analysis
        setResult(prev => ({
          ...prev,
          value: evaluated.toString(),
          inMeters: metersValue,
        }));
      } catch {
        // Not a unit or cannot be converted to meters
        metersValue = null;
        setResult({
          value: evaluated.toString(),
          inMeters: null,
          dimensionalAnalysis: {
            numericValue: null,
            units: null,
            error: null
          }
        });
      }
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

  const handleDerivedUnitSelect = (derivedUnit: string, value: string) => {
    // Clear specific unit selections when a derived unit is selected
    setSelectedUnits([]);
    
    try {
      if (result.value) {
        // Parse the value string to get just the numeric part
        const numericValue = parseFloat(value.split(' ')[0]);
        
        setResult(prev => ({
          ...prev,
          dimensionalAnalysis: {
            numericValue: numericValue,
            units: derivedUnit,
            error: null
          }
        }));
      }
    } catch (error) {
      console.error('Error selecting derived unit:', error);
    }
  };

  const getMissingUnits = (evaluated: math.Unit, selectedUnits: SelectedUnit[]): string[] => {
    const units = evaluated.units;
    const missingUnits: string[] = [];
    const selectedBaseTypes = new Set(selectedUnits.map(u => u.baseType));

    units.forEach(unitPart => {
      const baseType = unitPart.unit.base.key;
      
      // Special handling for compound units
      if (baseType === "PRESSURE") {
        if (!selectedBaseTypes.has("FORCE")) missingUnits.push("Force");
        if (!selectedBaseTypes.has("LENGTH")) missingUnits.push("Length");
      } else if (baseType === "ENERGY") {
        if (!selectedBaseTypes.has("MASS")) missingUnits.push("Mass");
        if (!selectedBaseTypes.has("LENGTH")) missingUnits.push("Length");
        if (!selectedBaseTypes.has("TIME")) missingUnits.push("Time");
      } else if (baseType === "POWER") {
        if (!selectedBaseTypes.has("MASS")) missingUnits.push("Mass");
        if (!selectedBaseTypes.has("LENGTH")) missingUnits.push("Length");
        if (!selectedBaseTypes.has("TIME")) missingUnits.push("Time");
      } else if (baseType === "SURFACE" || baseType === "AREA") {
        if (!selectedBaseTypes.has("LENGTH")) missingUnits.push("Length");
      } else if (baseType === "VOLUME") {
        if (!selectedBaseTypes.has("LENGTH")) missingUnits.push("Length");
      } else if (!selectedBaseTypes.has(baseType)) {
        missingUnits.push(baseType);
      }
    });

    return [...new Set(missingUnits)]; // Remove duplicates
  };

  const handleUnitSelection = (baseType: string, unit: string, power: number) => {
    // Create new selected units array
    const newSelectedUnits = [
      ...selectedUnits.filter(u => u.baseType !== baseType),
      { baseType, unit, power }
    ];
    
    setSelectedUnits(newSelectedUnits);
    
    try {
      if (result.value) {
        const evaluated = math.unit(result.value);
        const missingUnits = getMissingUnits(evaluated, newSelectedUnits);
        
        if (missingUnits.length === 0) {
          const newDimensionalAnalysis = calculateDimensionalAnalysis(evaluated, newSelectedUnits);
          setResult(prev => ({
            ...prev,
            dimensionalAnalysis: newDimensionalAnalysis
          }));
        } else {
          setResult(prev => ({
            ...prev,
            dimensionalAnalysis: {
              numericValue: null,
              units: null,
              error: `Missing required units: ${missingUnits.join(", ")}`
            }
          }));
        }
      }
    } catch (error) {
      console.error('Error updating dimensional analysis:', error);
    }
  };

  const shouldShowPredefinedUnits = (derivedUnits: DerivedUnit[], conversions: UnitConversion[]): boolean => {
    // Get all specific conversion units
    const specificUnits = new Set(
      conversions.flatMap(conv => 
        conv.conversions.map(c => c.unit)
      )
    );

    // Check if any predefined unit exists in specific units
    const hasOverlap = derivedUnits.some(derived =>
      derived.conversions.some(conv => specificUnits.has(conv.unit))
    );

    return !hasOverlap;
  };

  return (
    <div className="h-screen w-full flex items-center justify-center">
      <div className="flex flex-col gap-4 items-center">
        <div className="flex gap-4 items-center">
          <Input
            type="text"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              evaluateExpression(e.target.value);
            }}
            placeholder="Enter mathematical expression or unit (e.g., 5 m/s, 10 ft^3)..."
            className="w-[300px]"
          />
          <Button
            variant="outline"
            className="min-w-[200px] p-2"
            onClick={() => result.value && setIsModalOpen(true)}
          >
            {result.value || "Result will appear here"}
          </Button>
        </div>
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-6xl max-h-[80vh]">
          <DialogTitle className="sr-only">
            Unit Conversion Options
          </DialogTitle>
          <div className="flex gap-8 h-full">
            {/* Left side - Unit selections */}
            <div className="flex-1 flex flex-col gap-6 overflow-y-auto pr-4">
              {/* Predefined/Equivalent Units */}
              {conversions[0]?.derivedUnits && 
               conversions[0].derivedUnits.length > 0 && 
               shouldShowPredefinedUnits(conversions[0].derivedUnits, conversions) && (
                <>
                  <div className="space-y-4">
                    <div className="text-lg font-semibold">
                      Predefined Units
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      {conversions[0].derivedUnits.map((derived, i) => (
                        <div key={i} className="space-y-2">
                          <div className="border rounded-md p-2">
                            {derived.conversions.map((conv, j) => (
                              <Button 
                                key={j}
                                variant={result.dimensionalAnalysis.units === conv.unit ? "default" : "ghost"}
                                className="h-auto py-1 px-2 font-mono w-full text-left justify-start"
                                onClick={() => handleDerivedUnitSelect(conv.unit, conv.value)}
                              >
                                {conv.unit}: {conv.value}
                              </Button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Separator */}
                  <div className="relative py-8">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-t-2" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="bg-background px-6 py-2 text-muted-foreground font-semibold border rounded-full">
                        OR
                      </span>
                    </div>
                  </div>
                </>
              )}

              {/* Specific Unit Conversions */}
              <div className="space-y-4">
                <div className="text-lg font-semibold">
                  Specific Unit Conversions
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {conversions.map((conversion, i) => (
                    <div key={i} className="min-w-[200px]">
                      <div className="font-medium mb-2">
                        {conversion.baseType} (power: {conversion.power})
                      </div>
                      <div className="space-y-2 border rounded-md p-2">
                        {conversion.conversions.map((conv, j) => (
                          <UnitConversionButton
                            key={j}
                            conversion={conv}
                            baseType={conversion.baseType}
                            power={conversion.power}
                            isSelected={selectedUnits.some(u => u.unit === conv.unit)}
                            selectedUnits={selectedUnits}
                            onSelect={handleUnitSelection}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right side - Results */}
            <div className="w-[300px] border-l pl-8 space-y-6">
              <div className="space-y-4">
                <div className="text-lg font-semibold">Result</div>
                {selectedUnits.length > 0 ? (
                  <>
                    <div className="space-y-2">
                      <div className="font-medium">Selected Units:</div>
                      <div className="p-2 bg-muted rounded-md font-mono">
                        {getDimensionalExpression()}
                      </div>
                    </div>
                    {result.dimensionalAnalysis && (
                      <div className="space-y-2">
                        <div className="font-medium">Converted Value:</div>
                        <div className="p-2 bg-muted rounded-md">
                          {result.dimensionalAnalysis.error ? (
                            <div className="text-destructive">{result.dimensionalAnalysis.error}</div>
                          ) : result.dimensionalAnalysis.numericValue !== null ? (
                            <div className="font-mono flex gap-2 items-baseline">
                              <span className="text-lg">
                                {result.dimensionalAnalysis.numericValue.toFixed(6)}
                              </span>
                              <span className="text-muted-foreground">
                                {result.dimensionalAnalysis.units}
                              </span>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )}
                  </>
                ) : result.dimensionalAnalysis.units ? (
                  <div className="space-y-2">
                    <div className="font-medium">Converted Value:</div>
                    <div className="p-2 bg-muted rounded-md">
                      <div className="font-mono flex gap-2 items-baseline">
                        <span className="text-lg">
                          {result.dimensionalAnalysis.numericValue?.toFixed(6)}
                        </span>
                        <span className="text-muted-foreground">
                          {result.dimensionalAnalysis.units}
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-muted-foreground">
                    Select all required units from the specific unit conversion section to see the result
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
