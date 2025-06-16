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


}
return (
  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl overflow-hidden min-h-screen">
    <div className="bg-white shadow-lg p-8 border-b-4 border-blue-200">
      <h1 className="text-5xl font-bold text-center text-blue-900 flex items-center justify-center">
        <span className="mr-4 text-6xl">🍽️</span>
        {t("Meals.FoodInfo")}
      </h1>
    </div>

    <div className="p-8">
      {/* Enhanced Main Tab Navigation */}
      <div className="flex mb-8 bg-white rounded-3xl p-2 shadow-xl border-2 border-blue-200">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex-1 py-6 text-2xl font-bold rounded-2xl transition-all duration-300 flex items-center justify-center ${
            activeTab === 'list' 
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transform scale-105' 
              : 'text-blue-600 hover:bg-blue-50'
          }`}
        >
          <span className="mr-3 text-3xl">📋</span>
          {t("Meals.FoodList")}
        </button>
        <button
          onClick={() => setActiveTab('scanner')}
          className={`flex-1 py-6 text-2xl font-bold rounded-2xl transition-all duration-300 flex items-center justify-center ${
            activeTab === 'scanner' 
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 text-white shadow-lg transform scale-105' 
              : 'text-blue-600 hover:bg-blue-50'
          }`}
        >
          <span className="mr-3 text-3xl">📷</span>
          {t("Meals.scanBarcode")}
        </button>
      </div>
      
      {/* Enhanced Scanner View */}
      {activeTab === 'scanner' && (
        <div className="mb-8">
          <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-blue-200">
            <button
              onClick={toggleScanner}
              className={`w-full flex items-center justify-center px-8 py-6 rounded-2xl text-3xl font-bold mb-8 shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200 ${
                scanning 
                  ? "bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white" 
                  : "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white"
              }`}
            >
              <span className="mr-4 text-4xl">📷</span>
              {scanning ? "Stop Camera" : "Start Camera"}
            </button>

            {scanning && (
              <div className="relative">
                <div className="border-4 border-blue-400 rounded-3xl overflow-hidden shadow-2xl">
                  <BarcodeScannerComponent
                    width="100%"
                    height={400}
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
                    <div className="w-3/5 h-3/5 border-4 border-red-500 border-dashed rounded-2xl opacity-80"></div>
                  </div>
                </div>
                <div className="bg-blue-600 text-white p-4 rounded-b-2xl text-center">
                  <p className="text-2xl font-bold">
                    <span className="mr-3">🎯</span>
                    {t("Meals.positionLabel")}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Enhanced Meals List View */}
      {activeTab === 'list' && !meal && (
        <div>
          {/* Enhanced Search Box */}
          <div className="mb-8 bg-white rounded-3xl p-6 shadow-xl border-2 border-blue-200">
            <div className="relative">
              <input
                type="text"
                placeholder="Search for food by name..."
                value={searchTerm}
                onChange={handleSearch}
                className="w-full px-8 py-6 text-2xl border-3 border-blue-300 focus:border-blue-600 focus:ring-4 focus:ring-blue-200 rounded-2xl shadow-lg transition-all duration-200 pr-20"
                aria-label="Search for food"
              />
              <div className="absolute right-6 top-1/2 transform -translate-y-1/2 text-4xl text-blue-500">
                🔍
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-blue-200">
            <h2 className="text-4xl font-bold mb-8 text-blue-900 text-center flex items-center justify-center">
              <span className="mr-4 text-5xl">🍽️</span>
              {t("Meals.availableFoodsLabel")}
            </h2>
            
            {loading ? (
              <div className="flex flex-col justify-center items-center py-16">
                <div className="animate-spin rounded-full h-20 w-20 border-6 border-blue-500 border-t-transparent mb-6"></div>
                <p className="text-2xl text-gray-600 font-bold">{t("Meals.loadingLabel")}</p>
              </div>
            ) : filteredMeals.length === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-2xl text-gray-600 font-bold">
                  {searchTerm ? "No foods match your search" : "No foods found in the database"}
                </p>
              </div>
            ) : (
              <div className="space-y-8">
                {filteredMeals.map((food) => (
                  <div 
                    key={food._id} 
                    className="bg-gradient-to-r from-blue-50 to-blue-100 border-3 border-blue-200 hover:border-blue-400 rounded-3xl overflow-hidden shadow-xl hover:shadow-2xl transform hover:scale-[1.02] transition-all duration-300"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {/* Enhanced Food Image */}
                      <div className="md:col-span-1">
                        <img 
                          src={food.imageURL || "https://via.placeholder.com/300x200?text=Food+Image"} 
                          alt={food.name} 
                          className="w-full h-64 md:h-full object-cover"
                          onError={(e) => {
                            e.target.src = "https://via.placeholder.com/300x200?text=Food+Image";
                          }}
                        />
                      </div>
                      
                      {/* Enhanced Food Details */}
                      <div className="md:col-span-2 p-8">
                        <div className="bg-white rounded-2xl p-6 mb-6 shadow-lg border-2 border-blue-200">
                          <h3 className="text-3xl font-bold text-blue-900 flex items-center">
                            <span className="mr-3 text-4xl">🍽️</span>
                            {food.name}
                          </h3>
                          <p className="text-xl text-blue-600 mt-2 font-semibold">
                            <span className="mr-2">🏷️</span>
                            {t("Meals.barcodeLabel")} {food.barcode}
                          </p>
                        </div>
                        
                        <div className="mb-6">
                          <p className="text-xl text-gray-800 leading-relaxed line-clamp-3">{food.description}</p>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-4">
                          <button
                            onClick={() => selectMeal(food)}
                            className="flex-1 px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-xl font-bold rounded-2xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                          >
                            <span className="mr-3 text-2xl">👁️</span>
                            {t("Exercise.view_details")}
                          </button>
                          
                          {speaking ? (
                            <button
                              onClick={stopSpeaking}
                              className="flex-1 flex items-center justify-center px-6 py-4 rounded-2xl text-xl font-bold bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                              aria-label="Stop the speech"
                            >
                              <span className="mr-3 text-2xl">🔇</span>
                              {t("Meals.SpeakingLabel")}
                            </button>
                          ) : (
                            <button
                              onClick={() => speakText(createFoodDescription(food))}
                              className="flex-1 flex items-center justify-center px-6 py-4 rounded-2xl text-xl font-bold bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                            >
                              <span className="mr-3 text-2xl">🔊</span>
                              {t("Exercise.read")}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Enhanced Loading Indicator */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-3xl shadow-xl border-2 border-blue-200">
          <div className="animate-spin rounded-full h-20 w-20 border-6 border-blue-500 border-t-transparent mb-6"></div>
          <p className="text-3xl text-gray-600 font-bold">{t("Meals.loadingLabel")}</p>
        </div>
      )}
      
      {/* Enhanced Error Message */}
      {error && (
        <div className="bg-gradient-to-r from-red-100 to-red-200 border-4 border-red-400 text-red-800 p-8 rounded-3xl shadow-xl">
          <div className="text-center">
            <div className="text-6xl mb-4">⚠️</div>
            <h3 className="font-bold text-3xl mb-4">Error</h3>
            <p className="text-xl">{error}</p>
          </div>
        </div>
      )}
      
      {/* Enhanced Selected Meal Details */}
      {meal && (
        <div className="bg-gradient-to-r from-green-50 to-green-100 border-4 border-green-400 rounded-3xl shadow-2xl overflow-hidden">
          {/* Enhanced Food Image in detail view */}
          {meal.imageURL && (
            <div className="relative">
              <img 
                src={meal.imageURL} 
                alt={meal.name} 
                className="w-full h-96 object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black from-10% to-transparent"></div>
              <div className="absolute bottom-6 left-6 text-white">
                <h2 className="text-5xl font-bold mb-2">{meal.name}</h2>
                <p className="text-2xl font-semibold">
                  <span className="mr-2">🏷️</span>
                  {t("Meals.barcodeLabel")} {meal.barcode}
                </p>
              </div>
            </div>
          )}
          
          <div className="p-8">
            {!meal.imageURL && (
              <div className="text-center mb-8">
                <div className="text-6xl mb-4">🍽️</div>
                <h2 className="text-5xl font-bold text-green-900 mb-4">{meal.name}</h2>
                <p className="text-2xl text-green-700 font-semibold">
                  <span className="mr-2">🏷️</span>
                  {t("Meals.barcodeLabel")} {meal.barcode}
                </p>
              </div>
            )}
            
            <div className="flex justify-end mb-8">
              {speaking ? (
                <button
                  onClick={stopSpeaking}
                  className="flex items-center px-8 py-4 rounded-2xl text-2xl font-bold bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-400 hover:to-yellow-500 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
                  aria-label="Stop the speech"
                >
                  <span className="mr-3 text-3xl">🔇</span>
                  {t("Meals.SpeakingLabel")}
                </button>
              ) : (
                <button
                  onClick={() => speakText(createFoodDescription(meal))}
                  className="flex items-center px-8 py-4 rounded-2xl text-2xl font-bold bg-gradient-to-r from-green-600 to-green-700 hover:from-green-500 hover:to-green-600 text-white shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
                >
                  <span className="mr-3 text-3xl">🔊</span>
                  {t("Exercise.read")}
                </button>
              )}
            </div>
            
            <div className="bg-white rounded-3xl p-8 mb-8 shadow-xl border-2 border-green-200">
              <h3 className="text-3xl font-bold text-green-900 mb-6 flex items-center">
                <span className="mr-3 text-4xl">📝</span>
                {t("Exercise.descriptionLabel")}
              </h3>
              <p className="text-2xl text-gray-800 leading-relaxed">{meal.description}</p>
            </div>
            
            <div className="bg-white rounded-3xl p-8 shadow-xl border-2 border-green-200">
              <h3 className="text-3xl font-bold text-green-900 mb-6 flex items-center">
                <span className="mr-3 text-4xl">🥬</span>
                {t("Meals.ingredientsLabel")}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {meal.ingredients.map((item, idx) => (
                  <div key={idx} className="flex items-center py-4 px-6 bg-green-50 rounded-2xl border-2 border-green-200 shadow-md">
                    <span className="mr-4 text-green-600 text-3xl">✓</span>
                    <span className="text-xl font-semibold text-green-900">{item}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="mt-8 text-center">
              <button
                onClick={backToList}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white text-2xl font-bold rounded-2xl shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-200"
              >
                <span className="mr-3 text-3xl">← </span>
                {t("Meals.backToList")}
              </button>
            </div>
          </div>
        </div>
     )}
   </div>
 </div>
);
export default Meals;