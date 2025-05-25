import React, { useState, useEffect } from "react";
import { API } from "../config";
import { useTranslation } from "react-i18next";

function Exercise() {
  const { t } = useTranslation();
  const [exercises, setExercises] = useState([]);
  const [filteredExercises, setFilteredExercises] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [selectedExercise, setSelectedExercise] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [currentSpeakingId, setCurrentSpeakingId] = useState(null);

  // Fetch exercises when component mounts
  useEffect(() => {
    fetchExercises();
    
    // Clean up speech on unmount
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Filter exercises when filters change
  useEffect(() => {
    filterExercises();
  }, [exercises, selectedCategory, selectedDifficulty]);

  // Fetch exercises from API
  const fetchExercises = async () => {
    try {
      setLoading(true);
      
      // Try HTTPS first, fallback to HTTP
      let res;
      try {
        res = await fetch(`${API}/exercises/elderly-friendly`);
      } catch (err) {
        console.log("HTTPS failed, trying HTTP");
        res = await fetch('http://carebell.online/exercises/elderly-friendly');
      }
      
      if (!res.ok) {
        throw new Error(`Failed to fetch exercises: ${res.status} ${res.statusText}`);
      }
      
      const data = await res.json();
      console.log("Fetched exercises:", data);
      
      setExercises(data);
      setFilteredExercises(data);
      setLoading(false);
    } catch (err) {
      console.error("Error fetching exercises:", err);
      setError(`Could not load exercises: ${err.message}. Please check your server connection.`);
      setLoading(false);
    }
  };

  // Filter exercises based on selected criteria
  const filterExercises = () => {
    let filtered = exercises;
    
    if (selectedCategory !== 'All') {
      filtered = filtered.filter(exercise => exercise.category === selectedCategory);
    }
    
    if (selectedDifficulty !== 'All') {
      filtered = filtered.filter(exercise => exercise.difficulty === selectedDifficulty);
    }
    
    setFilteredExercises(filtered);
  };

  // Text-to-speech function with native voice selection
  const speakText = (text, exerciseId) => {
    // Stop any ongoing speech
    stopSpeaking();
    
    if (!text) return;
    
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Set properties for elderly-friendly speech
      utterance.rate = 0.8;  // Slower speed for elderly
      utterance.pitch = 1;   // Normal pitch
      utterance.volume = 1;  // Full volume
      
      // Try to get a native American English voice
      const voices = window.speechSynthesis.getVoices();
      const bestVoice = voices.find(voice => 
        voice.lang === 'en-US' && 
        (voice.name.includes('Samantha') || 
         voice.name.includes('Alex') ||     
         voice.name.includes('Daniel') ||  
         voice.name.includes('David'))
      ) || voices.find(voice => voice.lang === 'en-US');
      
      if (bestVoice) {
        utterance.voice = bestVoice;
      }
      
      // Start and end events
      utterance.onstart = () => {
        setSpeaking(true);
        setCurrentSpeakingId(exerciseId);
      };
      utterance.onend = () => {
        setSpeaking(false);
        setCurrentSpeakingId(null);
      };
      
      // Speak the text
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error("Speech synthesis error:", err);
    }
  };

  // Stop speaking function
  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      setCurrentSpeakingId(null);
    }
  };

  // Create exercise description for speech
  const createExerciseDescription = (exercise) => {
    if (!exercise) return "";
    
    let description = `This is ${exercise.name}. `;
    description += `${exercise.description}. `;
    description += `This is a ${exercise.difficulty} exercise targeting ${exercise.targetAreas.join(", ")}. `;
    description += `It takes about ${exercise.duration} minutes. `;
    
    if (exercise.benefits && exercise.benefits.length > 0) {
      description += `Benefits include: ${exercise.benefits.join(", ")}. `;
    }
    
    return description;
  };

  // Get unique categories from exercises
  const categories = ['All', ...new Set(exercises.map(ex => ex.category))];
  const difficulties = ['All', 'Easy', 'Medium', 'Hard'];

  // Sample exercises with GIF URLs
  const sampleExercisesData = [
    {
      guid: "elderly-exercise-001",
      name: "Wall Pushups",
      description: "Gentle pushups against a wall to strengthen chest and shoulders.",
      instructions: "1. Stand about 3 feet away from a wall, facing it with your feet shoulder-width apart\n2. Lean forward and place your hands flat on the wall, in line with your shoulders\n3. Your body should be in plank position, with your spine straight, not sagging or arched\n4. Lower your body toward the wall and then push back\n5. Repeat 10 times",
      difficulty: "Easy",
      targetAreas: ["Chest", "Shoulders", "Arms"],
      duration: 5,
      caloriesBurned: 20,
      reps: 10,
      sets: 1,
      equipment: ["Wall"],
      gifUrl: "https://i.pinimg.com/originals/46/bf/57/46bf5743497f7f39eb42b3ade9ee5236.gif",
      videoUrl: null,
      benefits: ["Strengthens upper body", "Improves posture", "Low impact on joints"],
      precautions: ["Use a stable wall", "Keep movements controlled", "Don't force movement"],
      modifications: ["Move closer to wall for easier version", "Start with fewer reps"],
      category: "Strength",
      elderlyFriendly: true
    },
    {
      guid: "elderly-exercise-002",
      name: "Seated Leg Extensions",
      description: "Gentle leg strengthening exercise done while sitting.",
      instructions: "1. Sit in a chair with back support\n2. Slowly extend one leg straight out\n3. Hold for 2-3 seconds\n4. Lower slowly\n5. Repeat with other leg",
      difficulty: "Easy",
      targetAreas: ["Quadriceps", "Knees"],
      duration: 4,
      caloriesBurned: 15,
      reps: 6,
      sets: 1,
      equipment: ["Chair"],
      gifUrl: "https://example.com/seated-leg-extensions.gif", // Replace with actual GIF
      videoUrl: null,
      benefits: ["Strengthens quadriceps", "Improves flexibility", "Low impact"],
      precautions: ["Don't lock knee completely", "Slow controlled movements"],
      modifications: ["Reduce range of motion", "Add ankle weights for challenge"],
      category: "Strength",
      elderlyFriendly: true
    },
    {
      guid: "elderly-exercise-003",
      name: "Neck Rolls",
      description: "Gentle neck movement to relieve stiffness.",
      instructions: "1. Sit or stand comfortably\n2. Slowly turn head to look right\n3. Then forward, left, back\n4. Repeat in opposite direction\n5. Do 4 complete rotations",
      difficulty: "Easy",
      targetAreas: ["Neck", "Shoulders"],
      duration: 2,
      caloriesBurned: 5,
      reps: 4,
      sets: 1,
      equipment: ["None"],
      gifUrl: "https://example.com/neck-rolls.gif", // Replace with actual GIF
      videoUrl: null,
      benefits: ["Reduces stiffness", "Improves neck mobility", "Relieves tension"],
      precautions: ["Move slowly", "Stop if dizzy", "Don't force movements"],
      modifications: ["Limit range of motion", "Do seated only"],
      category: "Flexibility",
      elderlyFriendly: true
    }
  ];

  // Handle populate database
  const populateDatabase = async () => {
    try {
      setLoading(true);
      
      const res = await fetch(`${API}/exercises/populate-sample`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ exercises: sampleExercisesData })
      });
      
      if (res.ok) {
        const data = await res.json();
        alert(`Success! Added ${data.exercises.length} exercises to the database.`);
        fetchExercises(); // Refresh the list
      } else {
        throw new Error('Failed to populate exercises');
      }
    } catch (err) {
      console.error('Error:', err);
      alert('Error adding exercises. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 max-w-6xl mx-auto bg-white shadow-lg rounded-lg">
      <h1 className="text-4xl font-bold mb-8 text-center text-blue-800">
        {t("Exercise.Library")}
      </h1>
      
      {/* Add exercises button if database is empty */}
      {exercises.length === 0 && !loading && (
        <div className="mb-8 p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h2 className="text-xl font-bold mb-4 text-yellow-800">{t("Exercise.no_exercises_label")}</h2>
          <p className="text-yellow-700 mb-4">
            {t("Exercise.no_exercises")}
          </p>
          <button
            onClick={populateDatabase}
            className="px-6 py-3 bg-green-600 text-white text-lg font-semibold rounded-lg hover:bg-green-700 transition-colors"
          >
            {t("Exercise.add_exercises")}
          </button>
        </div>
      )}
      
      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xl font-semibold mb-2">{t("Exercise.Category")} </label>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full p-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500"
          >
            {categories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>
        
        <div>
          <label className="block text-xl font-semibold mb-2">{t("Exercise.difficulty")}</label>
          <select
            value={selectedDifficulty}
            onChange={(e) => setSelectedDifficulty(e.target.value)}
            className="w-full p-3 text-lg border-2 border-gray-300 rounded-lg focus:border-blue-500"
          >
            {difficulties.map(difficulty => (
              <option key={difficulty} value={difficulty}>{difficulty}</option>
            ))}
          </select>
        </div>
      </div>
      
      {loading ? (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-500"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border-l-8 border-red-600 text-red-700 p-6 rounded-lg mb-6 text-xl">
          <h3 className="font-bold text-2xl mb-2">{t("Exercise.Error")}</h3>
          <p>{error}</p>
          <button 
            onClick={fetchExercises}
            className="mt-4 px-5 py-3 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t("Exercise.Try_Again")}
          </button>
        </div>
      ) : filteredExercises.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-xl text-gray-600 mb-4">
            {t("Exercise.no_exercises_criteria")}
          </p>
          {selectedDifficulty === 'Hard' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mt-4 max-w-md mx-auto">
              <p className="text-lg text-blue-800 mb-3">
                {t("Exercise.Hard_label")}
              </p>
              <button
                onClick={() => setSelectedDifficulty('Medium')}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {t("Exercise.showMedium")}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div>
          {/* Exercise List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredExercises.map((exercise) => (
              <div 
                key={exercise._id} 
                className={`border border-gray-200 rounded-lg overflow-hidden shadow-md hover:shadow-lg transition-shadow ${
                  currentSpeakingId === exercise._id ? "border-2 border-yellow-500" : ""
                }`}
              >
                <div className="relative">
                  {/* Show GIF in the exercise card */}
                  <img 
                    src={exercise.gifUrl || "https://via.placeholder.com/400x300?text=Exercise+GIF"} 
                    alt={exercise.name} 
                    className="w-full h-48 object-cover"
                    onError={(e) => {
                      e.target.src = "https://via.placeholder.com/400x300?text=Exercise+GIF";
                    }}
                  />
                  
                  <div className="absolute top-2 right-2">
                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                      exercise.difficulty === 'Easy' ? 'bg-green-500 text-white' :
                      exercise.difficulty === 'Medium' ? 'bg-yellow-500 text-black' :
                      'bg-red-500 text-white'
                    }`}>
                      {exercise.difficulty}
                    </span>
                  </div>
                </div>
                
                <div className="p-5">
                  <h3 className="text-2xl font-bold text-gray-800 mb-2">{exercise.name}</h3>
                  <p className="text-lg text-gray-600 mb-3">
                    <span className="font-medium">{t("Exercise.Category")}</span> {exercise.category} | 
                    <span className="font-medium"> {t("Exercise.duration")}</span> {exercise.duration} min
                  </p>
                  <p className="text-lg text-gray-700 mb-4 line-clamp-2">{exercise.description}</p>
                  
                  <div className="mb-4">
                    <span className="text-sm text-gray-600">{t("Exercise.target_areas")} </span>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {exercise.targetAreas.map((area, idx) => (
                        <span key={idx} className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
                          {area}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => setSelectedExercise(exercise)}
                      className="flex-1 px-2 py-0.5 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      {t("Exercise.view_details")}
                    </button>
                    
                    {currentSpeakingId === exercise._id && speaking ? (
                      <button
                        onClick={stopSpeaking}
                        className="flex-1 sm:flex-none sm:w-auto px-4 py-3 bg-yellow-500 text-white text-lg font-semibold rounded-lg"
                      >
                        <span className="mr-2">🔇</span>{t("Exercise.stop")}
                      </button>
                    ) : (
                      <button
                        onClick={() => speakText(createExerciseDescription(exercise), exercise._id)}
                        className="flex-1 sm:flex-1 sm:w-15 px-3 py-0.5 bg-green-600 text-white text-lg font-semibold rounded-lg"
                      >
                        <span className="mr-2">🔊</span>{t("Exercise.read")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Exercise Detail Modal */}
      {selectedExercise && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-3xl font-bold text-gray-800">{selectedExercise.name}</h2>
                <button
                  onClick={() => setSelectedExercise(null)}
                  className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
                >
                  ×
                </button>
              </div>
              
              {/* Display only GIF (same as the main card) */}
              {selectedExercise.gifUrl && (
                <div className="mb-6">
                  <div className="relative">
                    <img 
                      src={selectedExercise.gifUrl} 
                      alt={`${selectedExercise.name} Exercise Animation`} 
                      className="w-full rounded-lg"
                      onError={(e) => {
                        console.error('GIF failed to load:', selectedExercise.gifUrl);
                        e.target.parentNode.innerHTML = `
                          <div class="bg-gray-100 p-6 rounded-lg text-center">
                            <p class="text-gray-500">Exercise animation not available</p>
                            <p class="text-sm text-gray-400 mt-2">The exercise GIF could not be loaded.</p>
                          </div>
                        `;
                      }}
                    />
                  </div>
                </div>
              )}
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-bold mb-2">{t("Exercise.descriptionLabel")}</h3>
                  <p className="text-lg text-gray-700">{selectedExercise.description}</p>
                </div>
                
                <div>
                  <h3 className="text-xl font-bold mb-2">{t("Exercise.instructionsLabel")}</h3>
                  <div className="text-lg text-gray-700 whitespace-pre-line">{selectedExercise.instructions}</div>
                </div>
                
                {selectedExercise.benefits && selectedExercise.benefits.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold mb-2">{t("Exercise.benefitsLabel")}</h3>
                    <ul className="list-disc list-inside text-lg text-gray-700">
                      {selectedExercise.benefits.map((benefit, idx) => (
                        <li key={idx}>{benefit}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {selectedExercise.precautions && selectedExercise.precautions.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold mb-2 text-red-600">{t("Exercise.precautionsLabel")}</h3>
                    <ul className="list-disc list-inside text-lg text-red-700">
                      {selectedExercise.precautions.map((precaution, idx) => (
                        <li key={idx}>{precaution}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {selectedExercise.modifications && selectedExercise.modifications.length > 0 && (
                  <div>
                    <h3 className="text-xl font-bold mb-2 text-green-600">{t("Exercise.modificationsLabel")}</h3>
                    <ul className="list-disc list-inside text-lg text-green-700">
                      {selectedExercise.modifications.map((modification, idx) => (
                        <li key={idx}>{modification}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="flex gap-4 pt-4 border-t">
                  <button
                    onClick={() => speakText(createExerciseDescription(selectedExercise), selectedExercise._id)}
                    className="px-6 py-3 bg-blue-600 text-white text-lg font-semibold rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <span className="mr-2">🔊</span>{t("Exercise.readInstructions")}
                  </button>
                  
                  {selectedExercise.videoUrl && (
                    <a
                      href={selectedExercise.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-6 py-3 bg-gray-600 text-white text-lg font-semibold rounded-lg hover:bg-gray-700 transition-colors"
                    >
                      <span className="mr-2">▶️</span>{t("Exercise.watchVideo")}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Exercise;