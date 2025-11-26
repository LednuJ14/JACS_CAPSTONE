# JACS Property Management Platform

A modern, responsive property management dashboard built with React and Tailwind CSS, specifically designed for property management in **Cebu City, Philippines**.

## 🌟 Features

- **Property Management**: Comprehensive dashboard for landlords and property managers
- **Tenant Portal**: Easy-to-use interface for tenants to find and inquire about properties
- **Admin Panel**: Full administrative control with analytics and property review
- **Philippine Peso (₱)**: All pricing and financial data displayed in Philippine Peso
- **Cebu City Focus**: Optimized for the Cebu City property market
- **Responsive Design**: Mobile-first approach with modern UI/UX
- **Real-time Updates**: Live data updates and notifications

## 🏠 Location & Currency

- **Primary Market**: Cebu City, Cebu Province, Philippines
- **Currency**: Philippine Peso (₱)
- **Timezone**: Asia/Manila (UTC+8)
- **Phone Code**: +63 32 (Cebu City area code)

## Screenshots

The dashboard includes:
- Header with logo, title, "Rent Space" button, and profile icon
- Search section with location search and filter buttons
- Property grid showing 6 sample properties with images and details
- Pagination controls at the bottom
- Dark footer with copyright information

## Technologies Used

- **React 18**: Modern React with hooks and functional components
- **Tailwind CSS**: Utility-first CSS framework for styling
- **Unsplash Images**: High-quality property images for demonstration
- **Responsive Design**: Mobile-first approach with responsive grid

## Getting Started

### Prerequisites

- Node.js (version 14 or higher)
- npm or yarn package manager

### Installation

1. Clone the repository or navigate to the project directory
2. Navigate to the frontend directory:
   ```bash
   cd main-domain\frontend
   ```
3. Install dependencies:
   ```bash
   npm install
   ```

### Running the Application

4. Start the development server:
   ```bash
   npm start
   ```

2. Open your browser and navigate to `http://localhost:3000`

3. The application will automatically reload when you make changes to the code

### Building for Production

To create a production build:

```bash
npm run build
```

This will create an optimized build in the `build` folder.

## Project Structure

```
src/
├── components/
│   ├── Header.js          # Header component with logo and navigation
│   ├── SearchSection.js   # Search bar and filter buttons
│   ├── PropertyCard.js    # Individual property card component
│   ├── PropertyGrid.js    # Grid layout for property listings
│   ├── Pagination.js      # Pagination controls
│   └── Footer.js          # Footer component
├── App.js                 # Main application component
├── index.js              # React entry point
└── index.css             # Global styles and Tailwind imports
```

## Customization

### Adding New Properties

To add new properties, edit the `properties` array in `src/components/PropertyGrid.js`:

```javascript
const properties = [
  {
    id: 7,
    image: 'your-image-url',
    location: 'Your Location',
    price: '₱X,XXX/month',
    imageAlt: 'Description of the property'
  },
  // ... more properties
];
```

### Styling

The application uses Tailwind CSS for styling. You can customize colors, spacing, and other design elements by modifying the Tailwind classes in the component files.

### Configuration

- **Tailwind Config**: Edit `tailwind.config.js` to customize the design system
- **Package.json**: Update dependencies and scripts as needed

## Browser Support

The application supports all modern browsers:
- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

This project is created for educational and demonstration purposes.

## Contributing

Feel free to submit issues and enhancement requests!
