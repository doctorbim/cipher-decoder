import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import Papa from 'papaparse';
import _ from 'lodash';
import cipherData from '../data/cipher_2.csv';

import React, { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import Papa from 'papaparse';
import _ from 'lodash';

const CipherDecoder = () => {
  const [input, setInput] = useState('1A40A0100007EBD777779XDX');
  const [mappings, setMappings] = useState({});
  const [frequencyData, setFrequencyData] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedPosition, setSelectedPosition] = useState(null);
  const [possibleDecryptions, setPossibleDecryptions] = useState([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const response = await window.fs.readFile('cipher_2.csv', { encoding: 'utf8' });
        const parsed = Papa.parse(response, {
          header: true,
          skipEmptyLines: true
        });

        // Create position-based mapping dictionary and frequency data
        const positionMappings = {};
        const frequencies = {};
        
        parsed.data.forEach(row => {
          const scrambled = row.MetrcID;
          const unscrambled = row.MetrcTag;
          
          for (let i = 0; i < scrambled.length && i < unscrambled.length; i++) {
            if (!positionMappings[i]) {
              positionMappings[i] = new Map();
              frequencies[i] = {};
            }
            
            const scrambledChar = scrambled[i];
            const unscrambledChar = unscrambled[i];
            
            if (!positionMappings[i].has(scrambledChar)) {
              positionMappings[i].set(scrambledChar, new Set());
              frequencies[i][scrambledChar] = {};
            }
            
            positionMappings[i].get(scrambledChar).add(unscrambledChar);
            
            if (!frequencies[i][scrambledChar][unscrambledChar]) {
              frequencies[i][scrambledChar][unscrambledChar] = 0;
            }
            frequencies[i][scrambledChar][unscrambledChar]++;
          }
        });

        // Convert to regular object for easier use in React
        const mappingsObj = {};
        Object.entries(positionMappings).forEach(([position, mapping]) => {
          mappingsObj[position] = {};
          mapping.forEach((unscrambledChars, scrambledChar) => {
            mappingsObj[position][scrambledChar] = Array.from(unscrambledChars);
          });
        });

        setMappings(mappingsObj);
        setFrequencyData(frequencies);
        setLoading(false);
      } catch (error) {
        console.error('Error loading cipher data:', error);
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (!loading) {
      generatePossibleDecryptions();
    }
  }, [input, loading]);

  const generatePossibleDecryptions = () => {
    const possibilities = input.split('').map((char, pos) => {
      return mappings[pos]?.[char] || ['?'];
    });

    // Generate all possible combinations
    const generateCombinations = (arrays, current = [], index = 0) => {
      if (index === arrays.length) {
        return [current.join('')];
      }
      
      const results = [];
      for (const char of arrays[index]) {
        results.push(...generateCombinations(arrays, [...current, char], index + 1));
      }
      return results;
    };

    const allCombinations = generateCombinations(possibilities);
    
    // Calculate probabilities for each combination
    const combinationsWithProbs = allCombinations.map(combo => {
      let probability = 1;
      combo.split('').forEach((char, pos) => {
        const originalChar = input[pos];
        const totalMappings = Object.values(frequencyData[pos]?.[originalChar] || {}).reduce((a, b) => a + b, 0);
        const charFreq = frequencyData[pos]?.[originalChar]?.[char] || 0;
        probability *= totalMappings ? charFreq / totalMappings : 0;
      });
      
      return {
        decryption: combo,
        probability: probability * 100
      };
    });

    // Sort by probability and limit to top 100
    const sortedCombinations = combinationsWithProbs
      .sort((a, b) => b.probability - a.probability)
      .slice(0, 100);

    setPossibleDecryptions(sortedCombinations);
  };

  const getDecryptedChar = (char, position) => {
    if (!mappings[position] || !mappings[position][char]) {
      return '?';
    }
    const possibleChars = mappings[position][char];
    return possibleChars.length === 1 ? possibleChars[0] : `[${possibleChars.join('|')}]`;
  };

  const renderCharacterBox = (char, index) => {
    const isSelected = selectedPosition === index;
    const decryptedChar = getDecryptedChar(char, index);
    const possibilities = mappings[index]?.[char] || [];
    const isUnique = possibilities.length === 1;
    const isVariable = Object.keys(mappings[index] || {}).length > 1;

    return (
      <div 
        key={index}
        className={`flex flex-col items-center p-2 border rounded-md cursor-pointer
          ${isSelected ? 'bg-blue-100 border-blue-500' : 'hover:bg-gray-50'}
          ${isUnique ? 'bg-green-50' : ''}
          ${!isVariable ? 'opacity-50' : ''}`}
        onClick={() => setSelectedPosition(index)}
      >
        <div className="text-sm font-mono">{index}</div>
        <div className="text-lg font-mono font-bold">{char}</div>
        <div className="text-sm font-mono text-blue-600">{decryptedChar}</div>
      </div>
    );
  };

  const renderMappingDetails = () => {
    if (selectedPosition === null) return null;
    const positionMappings = mappings[selectedPosition] || {};
    const frequencies = frequencyData[selectedPosition] || {};
    
    return (
      <div className="mt-4 p-4 bg-gray-50 rounded-md">
        <h3 className="font-semibold mb-2">Position {selectedPosition} Details:</h3>
        <div className="grid grid-cols-4 gap-2">
          {Object.entries(positionMappings).map(([scrambled, unscrambled]) => {
            const totalFreq = Object.values(frequencies[scrambled] || {}).reduce((a, b) => a + b, 0);
            return (
              <div key={scrambled} className="p-2 bg-white rounded border">
                <div className="font-mono font-bold">{scrambled} → </div>
                {unscrambled.map(char => {
                  const freq = frequencies[scrambled]?.[char] || 0;
                  const percentage = ((freq / totalFreq) * 100).toFixed(1);
                  return (
                    <div key={char} className="text-sm">
                      {char}: {percentage}%
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderPossibleDecryptions = () => {
    if (possibleDecryptions.length === 0) return null;

    return (
      <div className="mt-4">
        <h3 className="font-semibold mb-2">Possible Decryptions:</h3>
        <div className="max-h-64 overflow-y-auto">
          {possibleDecryptions.map((item, index) => (
            <div 
              key={index}
              className="flex justify-between p-2 bg-white rounded border mb-1"
            >
              <div className="font-mono">{item.decryption}</div>
              <div className="text-sm text-gray-600">{item.probability.toFixed(4)}%</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return <div>Loading cipher data...</div>;
  }

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>2024 MetrcID Cipher Decoder</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Enter MetrcID:</label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value.toUpperCase())}
            className="w-full p-2 border rounded"
            maxLength={24}
          />
        </div>
        
        <div className="mb-4">
          <div className="text-sm font-medium mb-2">Decryption Process:</div>
          <div className="flex flex-wrap gap-1">
            {input.split('').map((char, index) => renderCharacterBox(char, index))}
          </div>
        </div>

        {renderMappingDetails()}
        {renderPossibleDecryptions()}
        
        <div className="mt-4 text-sm text-gray-600">
          <p>Color Key:</p>
          <ul className="list-disc list-inside">
            <li>Green background: Unique one-to-one mapping</li>
            <li>Blue background: Currently selected position</li>
            <li>Faded: Fixed position (no variation in data)</li>
            <li>Probabilities based on frequency in 2024 data</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default CipherDecoder;

const loadCipherData = async () => {
  try {
    const response = await fetch(cipherData);
    const csvText = await response.text();
    return Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true
    });
  } catch (error) {
    console.error('Error loading cipher data:', error);
    throw error;
  }
};

// Rest of the component code remains the same