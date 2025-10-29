import React, { useState, useEffect, useCallback } from 'react';
import './App.css';

/**
 * Utility function to extract ingredients from recipe details
 * The API returns ingredients across 20 different fields (strIngredient1, strIngredient2, etc.)
 * This function combines them into a clean array of objects
 */
const extractIngredients = (recipeDetails) => {
  const ingredients = [];
  
  // Loop through all possible ingredient fields (1-20)
  for (let i = 1; i <= 20; i++) {
    const ingredient = recipeDetails[`strIngredient${i}`];
    const measure = recipeDetails[`strMeasure${i}`];
    
    // Only add if ingredient exists and is not empty
    if (ingredient && ingredient.trim()) {
      ingredients.push({
        ingredient: ingredient.trim(),
        measure: (measure || '').trim()
      });
    }
  }
  
  return ingredients;
};

/**
 * Utility function to format recipe instructions
 * The API often returns instructions as one big block of text
 * This splits them into individual steps/paragraphs for better readability
 */
const formatInstructions = (instructions) => {
  if (!instructions) return [];
  
  return instructions
    .split('\n') // Split by new lines
    .filter(step => step.trim()) // Remove empty lines
    .map(step => step.trim()); // Clean up whitespace
};

/**
 * Main App Component - Recipe Finder for Taylor
 * Features:
 * - Search recipes by ingredient
 * - View recipes in a responsive grid
 * - Click recipes to see full details in a modal
 * - Mobile-first responsive design
 */
const App = () => {
  // State management
  const [searchQuery, setSearchQuery] = useState(''); // Current search input
  const [recipes, setRecipes] = useState([]); // List of search results
  const [loading, setLoading] = useState(false); // Search loading state
  const [error, setError] = useState(''); // Search error message
  const [hasSearched, setHasSearched] = useState(false); // Track if user has searched
  const [selectedRecipe, setSelectedRecipe] = useState(null); // Currently selected recipe for modal
  const [recipeDetails, setRecipeDetails] = useState(null); // Full details for selected recipe
  const [detailsLoading, setDetailsLoading] = useState(false); // Details loading state
  const [detailsError, setDetailsError] = useState(''); // Details error message

  /**
   * Search for recipes by ingredient using TheMealDB API
   * Handles loading states, errors, and response parsing
   */
  const searchRecipes = useCallback(async (query) => {
    if (!query.trim()) return;

    // Reset states for new search
    setLoading(true);
    setError('');
    setDetailsError('');
    setHasSearched(true);
    setSelectedRecipe(null);
    setRecipeDetails(null);

    // Support comma-separated list of ingredients (e.g. "chicken, tomato")
    const ingredients = query
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

    try {
      if (ingredients.length === 1) {
        // Single-ingredient (original behavior)
        const response = await fetch(
          `https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(ingredients[0])}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.meals) {
          setRecipes(data.meals);
        } else {
          setRecipes([]);
          setError(`No recipes found with "${query}". Try another ingredient like chicken, tomato, or pasta!`);
        }
      } else {
        // Multiple ingredients: fetch results for each ingredient in parallel
        const fetches = ingredients.map(ing =>
          fetch(`https://www.themealdb.com/api/json/v1/1/filter.php?i=${encodeURIComponent(ing)}`)
            .then(res => {
              if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
              return res.json();
            })
        );

        const results = await Promise.all(fetches);

        // If any ingredient returned no meals, there can't be a common intersection
        if (results.some(r => !r.meals)) {
          setRecipes([]);
          setError(`No recipes found that match all ingredients: "${ingredients.join(', ')}".`);
        } else {
          // Compute intersection by idMeal
          const idSets = results.map(r => new Set(r.meals.map(m => m.idMeal)));
          const firstList = results[0].meals;
          const commonIds = firstList
            .map(m => m.idMeal)
            .filter(id => idSets.every(s => s.has(id)));

          // Build meal objects for the common IDs (prefer the object from the first result)
          const mealMap = new Map(firstList.map(m => [m.idMeal, m]));
          const intersected = commonIds.map(id => {
            if (mealMap.has(id)) return mealMap.get(id);
            // fallback: search in other results
            for (const r of results) {
              const found = r.meals.find(m => m.idMeal === id);
              if (found) return found;
            }
            return null;
          }).filter(Boolean);

          if (intersected.length > 0) {
            setRecipes(intersected);
          } else {
            setRecipes([]);
            setError(`No recipes found that match all ingredients: "${ingredients.join(', ')}".`);
          }
        }
      }
    } catch (err) {
      console.error('Search error:', err);
      setError(
        err.name === 'TypeError'
          ? 'Network error: Please check your internet connection and try again.'
          : 'Sorry, we encountered an error while searching. Please try again in a moment.'
      );
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch full recipe details including ingredients and instructions
   * Called when a user clicks on a recipe card
   */
  const fetchRecipeDetails = useCallback(async (recipeId) => {
    if (!recipeId) return;
    
    setDetailsLoading(true);
    setDetailsError('');
    
    try {
      const response = await fetch(
        `https://www.themealdb.com/api/json/v1/1/lookup.php?i=${recipeId}`
      );
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.meals?.[0]) {
        setRecipeDetails(data.meals[0]);
      } else {
        throw new Error('Recipe details not found');
      }
    } catch (err) {
      console.error('Details fetch error:', err);
      setDetailsError(
        err.name === 'TypeError'
          ? 'Unable to load recipe details. Please check your connection.'
          : 'Sorry, we couldn\'t load the recipe details. Please try again.'
      );
      setRecipeDetails(null);
    } finally {
      setDetailsLoading(false);
    }
  }, []);

  /**
   * Handle recipe card click - opens modal and fetches details
   */
  const handleRecipeClick = useCallback(async (recipe) => {
    setSelectedRecipe(recipe);
    setRecipeDetails(null);
    await fetchRecipeDetails(recipe.idMeal);
  }, [fetchRecipeDetails]);

  /**
   * Close the recipe detail modal and reset related states
   */
  const closeModal = useCallback(() => {
    setSelectedRecipe(null);
    setRecipeDetails(null);
    setDetailsError('');
  }, []);

  // Close modal when Escape key is pressed
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && selectedRecipe) {
        closeModal();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [selectedRecipe, closeModal]);

  /**
   * Handle search form submission
   */
  const handleSubmit = (e) => {
    e.preventDefault();
    searchRecipes(searchQuery);
  };

  /**
   * Reset search and clear all states
   */
  const handleSearchAgain = () => {
    setSearchQuery('');
    setRecipes([]);
    setError('');
    setHasSearched(false);
    setSelectedRecipe(null);
    setRecipeDetails(null);
    setDetailsError('');
  };

  /**
   * Handle quick search from suggestion tags
   */
  const handleSuggestionClick = (ingredient) => {
    setSearchQuery(ingredient);
    searchRecipes(ingredient);
  };

  return (
    <div className="app">
      {/* Header Section with Search */}
      <header className="app-header">
        <div className="header-content">
          <h1 className="app-title">🍳 Recipe Finder</h1>
          <p className="app-subtitle">Quick recipes for busy people</p>
          
          <form onSubmit={handleSubmit} className="search-form">
            <div className="search-container">
              <div className="input-wrapper">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="What ingredient do you have? (chicken, tomato, rice...)"
                  className="search-input"
                  disabled={loading}
                  aria-label="Search for recipes by ingredient"
                />
                <span className="search-icon" aria-hidden="true">🔍</span>
              </div>
              <button 
                type="submit" 
                className="search-button"
                disabled={loading || !searchQuery.trim()}
                aria-label={loading ? 'Searching recipes' : 'Search recipes'}
              >
                {loading ? (
                  <>
                    <span className="spinner" aria-hidden="true"></span>
                    Searching...
                  </>
                ) : (
                  'Find Recipes'
                )}
              </button>
            </div>
          </form>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {/* Loading State */}
        {loading && (
          <div className="state-container" aria-live="polite" aria-busy="true">
            <div className="loading-spinner"></div>
            <p className="loading-text">Searching for recipes with "{searchQuery}"...</p>
          </div>
        )}
        
        {/* Error State */}
        {error && (
          <div className="state-container" aria-live="polite">
            <div className="error-icon">😕</div>
            <h3 className="error-title">No recipes found</h3>
            <p className="error-message">{error}</p>
            <button 
              className="retry-button" 
              onClick={handleSearchAgain}
              aria-label="Try another ingredient"
            >
              Try Another Ingredient
            </button>
          </div>
        )}
        
        {/* Results Grid */}
        {!loading && !error && recipes.length > 0 && (
          <section className="recipes-section" aria-live="polite">
            <div className="section-header">
              <h2 className="results-title">
                Found {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} with "{searchQuery}"
              </h2>
              <button 
                className="clear-button" 
                onClick={handleSearchAgain}
                aria-label="Start new search"
              >
                New Search
              </button>
            </div>
            <div className="recipes-grid">
              {recipes.map((recipe) => (
                <article 
                  key={recipe.idMeal} 
                  className="recipe-card"
                  onClick={() => handleRecipeClick(recipe)}
                  tabIndex={0}
                  onKeyPress={(e) => e.key === 'Enter' && handleRecipeClick(recipe)}
                  role="button"
                  aria-label={`View recipe for ${recipe.strMeal}`}
                >
                  <div className="card-image">
                    <img 
                      src={recipe.strMealThumb} 
                      alt={recipe.strMeal}
                      loading="lazy"
                    />
                  </div>
                  <div className="card-content">
                    <h3 className="recipe-title">{recipe.strMeal}</h3>
                    <div className="view-recipe-button" aria-hidden="true">
                      View Recipe →
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
        
        {/* Empty State - Before Search */}
        {!loading && !error && !hasSearched && (
          <div className="state-container">
            <div className="welcome-icon">👨‍🍳</div>
            <h3 className="welcome-title">Welcome, Taylor!</h3>
            <p className="welcome-message">
              Enter an ingredient you have to find delicious recipes quickly.
            </p>
            <div className="suggestions">
              {['chicken', 'tomato', 'pasta', 'rice'].map((ingredient) => (
                <button
                  key={ingredient}
                  className="suggestion-tag"
                  onClick={() => handleSuggestionClick(ingredient)}
                  type="button"
                >
                  {ingredient}
                </button>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Recipe Detail Modal */}
      {selectedRecipe && (
        <div 
          className="modal-overlay" 
          onClick={closeModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="modal-header">
              <h2 id="modal-title" className="modal-title">
                {recipeDetails ? recipeDetails.strMeal : selectedRecipe.strMeal}
              </h2>
              <button 
                className="modal-close"
                onClick={closeModal}
                aria-label="Close recipe details"
              >
                ×
              </button>
            </div>

            {/* Modal Body */}
            <div className="modal-body">
              {detailsLoading ? (
                <div className="modal-loading" aria-live="polite" aria-busy="true">
                  <div className="loading-spinner"></div>
                  <p>Loading recipe details...</p>
                </div>
              ) : detailsError ? (
                <div className="modal-error" aria-live="polite">
                  <div className="error-icon">⚠️</div>
                  <h3>Unable to Load Recipe</h3>
                  <p>{detailsError}</p>
                  <button 
                    className="retry-button"
                    onClick={() => fetchRecipeDetails(selectedRecipe.idMeal)}
                  >
                    Try Again
                  </button>
                </div>
              ) : recipeDetails ? (
                <div className="recipe-details">
                  {/* Recipe Image and Basic Info */}
                  <div className="recipe-hero">
                    <img 
                      src={recipeDetails.strMealThumb} 
                      alt={recipeDetails.strMeal}
                      className="recipe-detail-image"
                    />
                    <div className="recipe-meta">
                      {recipeDetails.strArea && (
                        <div className="meta-item">
                          <span className="meta-label">Cuisine:</span>
                          <span className="meta-value">{recipeDetails.strArea}</span>
                        </div>
                      )}
                      {recipeDetails.strCategory && (
                        <div className="meta-item">
                          <span className="meta-label">Category:</span>
                          <span className="meta-value">{recipeDetails.strCategory}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Ingredients Section */}
                  <section className="ingredients-section" aria-labelledby="ingredients-title">
                    <h3 id="ingredients-title" className="section-title">Ingredients</h3>
                    <div className="ingredients-grid">
                      {extractIngredients(recipeDetails).map((item, index) => (
                        <div key={index} className="ingredient-item">
                          <span className="ingredient-measure">{item.measure}</span>
                          <span className="ingredient-name">{item.ingredient}</span>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Instructions Section */}
                  <section className="instructions-section" aria-labelledby="instructions-title">
                    <h3 id="instructions-title" className="section-title">Instructions</h3>
                    <div className="instructions">
                      {formatInstructions(recipeDetails.strInstructions).map((step, index) => (
                        <div key={index} className="instruction-step">
                          <span className="step-number">{index + 1}</span>
                          <p className="step-text">{step}</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  {/* Video Link */}
                  {recipeDetails.strYoutube && (
                    <section className="video-section" aria-labelledby="video-title">
                      <h3 id="video-title" className="section-title">Video Tutorial</h3>
                      <a 
                        href={recipeDetails.strYoutube} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="video-link"
                      >
                        📺 Watch on YouTube
                      </a>
                    </section>
                  )}
                </div>
              ) : null}
            </div>

            {/* Modal Footer with Close Button */}
            <div className="modal-footer">
              <button 
                className="close-button"
                onClick={closeModal}
              >
                Close Recipe
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;