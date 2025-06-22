import React, { useState, useEffect } from "react";
import BarcodeScannerComponent from "react-qr-barcode-scanner";
import { API } from "../config";
import { useTranslation } from "react-i18next";

function Meals() {
  /* ---- Translation ---- */
    const { t } = useTranslation();
  // Main state variables
  const [activeTab, setActiveTab] = useState('list'); // 'list' or 'scanner'
  const [allMeals, setAllMeals] = useState([]);
  const [filteredMeals, setFilteredMeals] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [scanning, setScanning] = useState(false);
  const [barcode, setBarcode] = useState(null);
  const [meal, setMeal] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [speaking, setSpeaking] = useState(false);

  // Fetch all meals when component mounts and initialize speech voices
  useEffect(() => {
    fetchAllMeals();
    
    // Set up event listener for speech synthesis voices
    if (window.speechSynthesis) {
      // Sometimes voices aren't loaded immediately, so we need to handle that
      let voicesLoaded = false;
      
      const loadVoices = () => {
        // Get the list of voices
        const voices = window.speechSynthesis.getVoices();
        
        if (voices.length > 0) {
          voicesLoaded = true;
          console.log("Speech voices loaded:", voices.length);
          
          // Log available English voices for debugging
          const englishVoices = voices.filter(voice => voice.lang.startsWith('en'));
          console.log("Available English voices:", englishVoices.map(v => `${v.name} (${v.lang})`));
        }
      };
      
      // Load voices right away
      loadVoices();
      
      // And also set up an event listener for when voices change/load
      if (window.speechSynthesis.onvoiceschanged !== undefined) {
        window.speechSynthesis.onvoiceschanged = loadVoices;
      }
      
      // If voices haven't loaded after 1 second, try again
      if (!voicesLoaded) {
        setTimeout(loadVoices, 1000);
      }
      
      // Clean up the event listener when component unmounts
      return () => {
        if (window.speechSynthesis.onvoiceschanged !== undefined) {
          window.speechSynthesis.onvoiceschanged = null;
        }
      };
    }
  }, []);

  // Clean up speech on unmount
  useEffect(() => {
    // Clean up function to stop any ongoing speech when component unmounts
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Fetch all meals from the database
  const fetchAllMeals = async () => {
    try {
      setLoading(true);
      console.log("Fetching all meals from API");
      
      // Using HTTPS as requested
      const res = await fetch(`${API}/foods`);
      
      if (!res.ok) {
        throw new Error(`Failed to fetch meals: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log("Fetched meals data:", data);
      
      // If we have data from the API, use it
      if (data && Array.isArray(data)) {
        setAllMeals(data);
        setFilteredMeals(data);
        console.log(`Successfully loaded ${data.length} meals from database`);
      } else {
        // Handle invalid data format
        console.warn("API returned invalid data format");
        throw new Error("Invalid data format received from API");
      }
      
      setLoading(false);
    } catch (err) {
      console.error("Error fetching meals:", err);
      setError(`Could not load meals list: ${err.message}. Please check your server connection.`);
      
      // Clear any existing data
      setAllMeals([]);
      setFilteredMeals([]);
      setLoading(false);
    }
  };

  // Filter meals based on search term
  const handleSearch = (e) => {
    const term = e.target.value;
    setSearchTerm(term);
    
    if (!term.trim()) {
      setFilteredMeals(allMeals);
      return;
    }
    
    const searchResults = allMeals.filter(meal => 
      meal.name.toLowerCase().includes(term.toLowerCase()) || 
      meal.description.toLowerCase().includes(term.toLowerCase())
    );
    
    setFilteredMeals(searchResults);
  };

  // Toggle camera on/off
  const toggleScanner = () => {
    setScanning(!scanning);
    if (scanning) {
      setBarcode(null);
      setError('');
    } else {
      speakText("Please position the QR code in front of the camera");
    }
  };

  // Text-to-speech function with slower speed for elderly users
  const speakText = (text) => {
    // Stop any ongoing speech
    stopSpeaking();
    
    if (!text) return;
    
    try {
      // Create a new speech utterance
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Set properties for elderly-friendly speech
      utterance.rate = 0.8; // Slower speed for elderly
      utterance.pitch = 1;
      utterance.volume = 1;
      
      // Get available voices
      const voices = window.speechSynthesis.getVoices();
      
      // Try to find a native English voice without an accent
      // Priority order: US English, UK English, then any English
      let selectedVoice = voices.find(voice => 
        voice.lang === 'en-US' && 
        (voice.name.includes('Google US English') || 
         voice.name.includes('Microsoft David') || 
         voice.name.includes('Samantha'))
      );
      
      // If no US voice found, try UK voice
      if (!selectedVoice) {
        selectedVoice = voices.find(voice => 
          voice.lang === 'en-GB' && 
          (voice.name.includes('Google UK English') || 
           voice.name.includes('Microsoft George') || 
           voice.name.includes('Daniel'))
        );
      }
      
      // If still no voice found, try any English voice
      if (!selectedVoice) {
        selectedVoice = voices.find(voice => 
          voice.lang.startsWith('en')
        );
      }
      
      // If a suitable voice was found, use it
      if (selectedVoice) {
        console.log("Using voice:", selectedVoice.name);
        utterance.voice = selectedVoice;
      }
      
      // Start and end events
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      
      // Speak the text
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Speech synthesis error:", err);
    }
  };
  
  // Function to stop any ongoing speech
  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
  };
  
  // Create a description for text-to-speech
  const createFoodDescription = (foodItem) => {
    if (!foodItem) return "";
    
    // Create an elderly-friendly description
    let description = `This is ${foodItem.name}. `;
    description += `${foodItem.description}. `;
    description += `It contains the following ingredients: ${foodItem.ingredients.join(", ")}. `;
    
    return description;
  };

  // Handle barcode detection
  const handleDetected = async (err, result) => {
    // Handle scanner errors
    if (err) {
      console.error("Scanner error:", err);
      return;
    }
    
    // Process barcode result
    if (result) {
      const scannedCode = result.text;
      console.log("BARCODE DETECTED: ", scannedCode);
      
      // Stop scanning and show loading state
      setScanning(false);
      setBarcode(scannedCode);
      setError('');
      setLoading(true);
      
      // Voice feedback
      speakText("QR code scanned successfully. Looking up food information.");

      try {
        // Fetch food data from API
        console.log(`Fetching data for barcode: ${scannedCode}`);
        // Using HTTPS as requested
        const res = await fetch(`${API}/${scannedCode}`);
        setLoading(false);
        
        if (!res.ok) {
          if (res.status === 404) {
            speakText("Sorry, this food was not found in our database.");
            throw new Error("Food item not found in database");
          } else {
            speakText("Sorry, there was a problem connecting to our system.");
            throw new Error(`Server error: ${res.status} ${res.statusText}`);
          }
        }
        
        const data = await res.json();
        console.log("Food data received:", data);
        setMeal(data);
        
        // Read out the food information after a short delay
        setTimeout(() => {
          speakText(createFoodDescription(data));
        }, 1000);
        
      } catch (err) {
        setLoading(false);
        console.error("Fetch error details:", err);
        
        // Look for the food in our allMeals list as a fallback
        const foundMeal = allMeals.find(item => item.barcode === scannedCode);
        if (foundMeal) {
          console.log("Found meal in local data:", foundMeal);
          setMeal(foundMeal);
          speakText("Found food information in our local database.");
          setTimeout(() => {
            speakText(createFoodDescription(foundMeal));
          }, 1000);
        } else {
          setError(`Food with code ${scannedCode} was not found in our database.`);
          setMeal(null);
          speakText("Sorry, this food was not found in our database.");
        }
      }
    }
  };
  
  // Select a meal from the list
  const selectMeal = (selectedMeal) => {
    setMeal(selectedMeal);
    setTimeout(() => {
      speakText(createFoodDescription(selectedMeal));
    }, 500);
  };

  // Clear the selected meal and show the list
  const backToList = () => {
    setMeal(null);
    setActiveTab('list');
  };

  return (
    <div className="p-4 max-w-4xl mx-auto bg-white dark:bg-gray-800 shadow-lg rounded-lg">
      <h1 className="text-4xl font-bold mb-8 text-center text-blue-800">{t("Meals.FoodInfo")}</h1>
      
      {/* Main Tab Navigation - Large, easy to press buttons */}
      <div className="flex mb-8">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-4 text-2xl font-bold rounded-tl-lg rounded-bl-lg ${
            activeTab === 'list' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          {t("Meals.FoodList")}
        </button>
        <button
          onClick={() => setActiveTab('scanner')}
          className={`flex-1 py-4 text-2xl font-bold rounded-tr-lg rounded-br-lg ${
            activeTab === 'scanner' 
              ? 'bg-blue-600 text-white' 
              : 'bg-gray-200 text-gray-700'
          }`}
        >
          {t("Meals.scanBarcode")}
        </button>
      </div>
      
      {/* Scanner View */}
      {activeTab === 'scanner' && (
        <div className="mb-6">
          <button
            onClick={toggleScanner}
            className={`w-full flex items-center justify-center px-6 py-5 rounded-lg text-2xl font-bold mb-6 ${
              scanning ? "bg-red-500 text-white" : "bg-green-500 text-white"
            }`}
          >
            <span className="mr-3 text-3xl" role="img" aria-hidden="true">📷</span>
            {scanning ? "Stop Camera" : "Start Camera"}
          </button>

          {scanning && (
            <div className="relative mb-8">
              <div className="border-4 border-blue-400 rounded-lg overflow-hidden">
                <BarcodeScannerComponent
                  width="100%"
                  height={350}
                  onUpdate={handleDetected}
                  facingMode="environment"
                  delay={300}
                  videoConstraints={{
                    facingMode: "environment",
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-3/5 h-3/5 border-4 border-red-500 border-dashed rounded opacity-70 items-center justify-center"></div>
                </div>
              </div>
              <p className="text-center text-xl mt-4 text-gray-600 font-medium">
                {t("Meals.positionLabel")}
              </p>
            </div>
          )}
        </div>
      )}
      
      {/* Meals List View */}
      {activeTab === 'list' && !meal && (
        <div>
          {/* Search Box - Large and easy to use */}
          <div className="mb-6">
            <div className="relative">
              <input
                type="text"
                placeholder="Search for food by name..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full px-5 py-4 text-xl border-2 border-gray-300 rounded-lg focus:border-blue-500 focus:outline-none dark:border-yellow-300 dark:bg-gray-600"
                aria-label="Search for food"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2 text-2xl text-gray-500">
                🔍
              </div>
            </div>
          </div>
          
          <h2 className="text-3xl font-bold mb-6 text-gray-800">{t("Meals.availableFoodsLabel")}</h2>
          
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500"></div>
            </div>
          ) : filteredMeals.length === 0 ? (
            <p className="text-xl text-center py-8 text-gray-500">
              {searchTerm ? "No foods match your search" : "No foods found in the database"}
            </p>
          ) : (
            <ul className="space-y-6">
              {filteredMeals.map((food) => (
                <li 
                  key={food._id} 
                  className="border border-gray-200 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow dark:border-yellow-400"
                >
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Food Image */}
                    <div className="md:col-span-1">
                      <img 
                        src={food.imageURL || "https://via.placeholder.com/300x200?text=Food+Image"} 
                        alt={food.name} 
                        className="w-full h-48 md:h-full object-cover"
                        onError={(e) => {
                          e.target.src = "https://via.placeholder.com/300x200?text=Food+Image";
                        }}
                      />
                    </div>
                    
                    {/* Food Details */}
                    <div className="md:col-span-2 p-5">
                      <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-t-md -mx-5 -mt-5">
                        <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100">{food.name}</h3>
                        <p className="text-gray-500 dark:text-gray-300 mt-1">{t("Meals.barcodeLabel")} {food.barcode}</p>
                      </div>
                      
                      <div className="mt-4">
                        <p className="text-lg text-gray-700 mb-4 line-clamp-2">{food.description}</p>
                        
                        <div className="flex flex-col sm:flex-row gap-3 justify-between items-center">
                          <button
                            onClick={() => selectMeal(food)}
                            className="w-full sm:w-15 px-3 py-1 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                          >
                            {t("Exercise.viewDetails")}
                          </button>
                          
                          {speaking ? (
                            <button
                              onClick={stopSpeaking}
                              className="w-full sm:w-auto flex items-center justify-center px-5 py-3 rounded-lg text-lg font-semibold bg-yellow-500 text-white"
                              aria-label="Stop the speech"
                            >
                              <span className="mr-2 text-xl">🔇</span>
                              {t("Meals.SpeakingLabel")}
                            </button>
                          ) : (
                            <button
                              onClick={() => speakText(createFoodDescription(food))}
                              className="w-full sm:w-15 flex items-center justify-center px-3 py-1 rounded-lg text-lg font-semibold bg-green-600 text-white"
                            >
                              <span className="mr-2 text-xl">🔊</span>
                              {t("Exercise.read")}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      
      {/* Loading Indicator */}
      {loading && (
        <div className="flex flex-col items-center justify-center my-8 py-6">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500 mb-4 dark:border-yellow-500"></div>
          <p className="text-2xl text-gray-600">{t("Meals.loadingLabel")}</p>
        </div>
      )}
      
      {/* Error Message */}
      {error && (
        <div className="bg-red-100 border-l-8 border-red-600 text-red-700 p-6 rounded-lg mb-6 text-xl">
          <h3 className="font-bold text-2xl mb-2">Error</h3>
          <p>{error}</p>
        </div>
      )}
      
      {/* Selected Meal Details */}
      {meal && (
        <div className="bg-green-50 p-8 mt-8 rounded-lg border-l-8 border-green-500 shadow-lg">
          {/* Food Image in detail view */}
          {meal.imageURL && (
            <div className="mb-6">
              <img 
                src={meal.imageURL} 
                alt={meal.name} 
                className="w-full max-w-md mx-auto rounded-lg shadow-md"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
          )}
          
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">{meal.name}</h2>
              <p className="text-gray-600 text-xl mb-4">{t("Meals.barcodeLabel")} {meal.barcode}</p>
            </div>
            
            {speaking ? (
              <button
                onClick={stopSpeaking}
                className="flex items-center px-5 py-3 rounded-lg text-xl font-semibold bg-yellow-500 text-white"
                aria-label="Stop the speech"
              >
                <span className="mr-2 text-2xl">🔇</span>
                {t("Meals.SpeakingLabel")}
              </button>
            ) : (
              <button
                onClick={() => speakText(createFoodDescription(meal))}
                className="flex items-center px-5 py-3 rounded-lg text-xl font-semibold bg-green-600 text-white"
              >
                <span className="mr-2 text-2xl">🔊</span>
                {t("Exercise.read")}
              </button>
            )}
          </div>
          
          <div className="my-6">
            <h3 className="text-2xl font-semibold text-gray-800 mb-3">{t("Exercise.descriptionLabel")}</h3>
            <p className="text-xl text-gray-700 leading-relaxed">{meal.description}</p>
          </div>
          
          <div className="mt-6">
            <h3 className="text-2xl font-semibold text-gray-800 mb-3">{t("Meals.ingredientsLabel")}</h3>
            <ul className="bg-white rounded-lg p-5 border border-gray-100 shadow-sm">
              {meal.ingredients.map((item, idx) => (
                <li key={idx} className="py-3 text-xl border-b border-gray-100 last:border-0 flex items-center dark:border-yellow-300">
                  <span className="mr-3 text-green-500 text-2xl">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="mt-8 flex justify-center">
            <button
              onClick={backToList}
              className="px-6 py-3 bg-blue-600 text-white text-xl font-semibold rounded-lg hover:bg-blue-700 transition-colors"
            >
              {t("Meals.backToList")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default Meals;