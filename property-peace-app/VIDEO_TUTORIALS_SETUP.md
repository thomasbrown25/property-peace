# Video Tutorials Implementation Guide

This guide explains how to set up and use the instructional video system in Brownstone Hub.

## 📋 Overview

The video tutorial system provides:
- **YouTube-based hosting** (recommended for CDN, analytics, and SEO)
- **Contextual help buttons** on relevant pages
- **Dedicated Help/Tutorials page** with searchable video library
- **Onboarding flow** for new users
- **Easy integration** into any page

## 🎬 Step 1: Upload Videos to YouTube

1. Upload your 7 instructional videos to YouTube
2. Set videos to **Unlisted** (not Private) so they can be embedded
3. For each video, copy the **Video ID** from the URL:
   - Example: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`
   - Video ID is: `dQw4w9WgXcQ`

## 📝 Step 2: Add Video IDs to Configuration

Edit `property-peace-app/src/data/videos.js` and replace the placeholder IDs:

```javascript
export const INSTRUCTIONAL_VIDEOS = {
  addUser: {
    id: 'YOUR_YOUTUBE_VIDEO_ID_HERE', // Replace this
    title: 'How to add a user to your account',
    // ... rest of config
  },
  connectBankAccount: {
    id: 'YOUR_YOUTUBE_VIDEO_ID_HERE', // Replace this
    title: 'How to connect bank account to receive payments',
    // ... rest of config
  },
  // ... update all 7 videos
};
```

## 🚀 Step 3: Access Points

### A. Help/Tutorials Page
Users can access all videos at: `/landlord/help`

- Searchable video library
- Category filtering
- Click any video thumbnail to watch

### B. Support Settings
Added to Settings → Support tab:
- "Video Tutorials" card with link to Help page

### C. Contextual Help Buttons
Help buttons are already added to:
- Property Add page (`/landlord/properties/add`)
- More can be added to other pages (see below)

### D. Onboarding (Optional)
To enable onboarding for new users, wrap your dashboard:

```javascript
// In dashboard.jsx or layout
import OnboardingWrapper from 'components/onboarding/OnboardingWrapper';

<OnboardingWrapper>
  <Dashboard />
</OnboardingWrapper>
```

## 🔧 Step 4: Add Help Buttons to More Pages

To add contextual help to any page:

```javascript
import VideoHelpButton from 'components/videos/VideoHelpButton';
import { getVideo } from 'data/videos';

// In your component, add next to the page title:
<Stack direction="row" alignItems="center" spacing={2}>
  <Typography variant="h4">Your Page Title</Typography>
  {getVideo('createLease') && (
    <VideoHelpButton
      videoId={getVideo('createLease').id}
      title={getVideo('createLease').title}
      description={getVideo('createLease').description}
      tooltip="Watch tutorial: How to create a lease"
    />
  )}
</Stack>
```

## 📚 Available Video Keys

Use these keys with `getVideo()`:

- `addUser` - How to add a user to your account
- `connectBankAccount` - How to connect bank account to receive payments
- `createProperty` - How to create a property
- `createLease` - How to create a lease
- `messageTenant` - How to message a tenant
- `sendApplication` - How to send application to tenant
- `uploadMoveInPhotos` - How to upload before move-in photos

## 🎨 Customization

### Change Video Categories
Edit `VIDEO_CATEGORIES` in `data/videos.js`:

```javascript
export const VIDEO_CATEGORIES = {
  setup: 'Your Category Name',
  // ...
};
```

### Add Page-to-Video Mappings
Edit `PAGE_VIDEOS` in `data/videos.js` to auto-suggest videos based on current page:

```javascript
export const PAGE_VIDEOS = {
  '/landlord/your-page': 'videoKey',
  // ...
};
```

### Customize Onboarding Videos
Edit `OnboardingDialog.jsx` to change which videos appear in onboarding:

```javascript
const onboardingVideos = getAllVideos().slice(0, 4); // Change number or filter
```

## 📦 Components Available

### VideoPlayer
Basic video player with thumbnail:
```javascript
import VideoPlayer from 'components/videos/VideoPlayer';

<VideoPlayer 
  videoId="YOUTUBE_VIDEO_ID"
  title="Video Title"
  description="Optional description"
  autoPlay={false}
/>
```

### VideoHelpButton
Icon button that opens video dialog:
```javascript
import VideoHelpButton from 'components/videos/VideoHelpButton';

<VideoHelpButton
  videoId="YOUTUBE_VIDEO_ID"
  title="Video Title"
  tooltip="Watch tutorial"
/>
```

### VideoDialog
Modal dialog with video player:
```javascript
import VideoDialog from 'components/videos/VideoDialog';

<VideoDialog
  open={isOpen}
  onClose={() => setIsOpen(false)}
  videoId="YOUTUBE_VIDEO_ID"
  title="Video Title"
/>
```

## 🔄 Alternative: Using Azure Blob Storage Instead

If you prefer to host videos in Azure Blob Storage instead of YouTube:

1. Upload videos to your Azure Blob Storage container
2. Create a video service similar to `ImageService.cs`
3. Modify `VideoPlayer.jsx` to use `<video>` tag instead of YouTube iframe:

```javascript
// In VideoPlayer.jsx, replace YouTube embed with:
<video
  controls
  src={videoUrl} // Your blob URL with SAS token
  style={{ width: '100%', height: '100%' }}
/>
```

**Note:** YouTube is recommended because:
- ✅ Free CDN and bandwidth
- ✅ Built-in analytics
- ✅ Automatic transcoding for different devices
- ✅ Better SEO
- ✅ No storage costs

## ✅ Testing Checklist

- [ ] All 7 video IDs are added to `videos.js`
- [ ] Help page loads at `/landlord/help`
- [ ] Videos play when clicked
- [ ] Search and filter work on Help page
- [ ] Help button appears on Property Add page
- [ ] Support Settings has "Video Tutorials" link
- [ ] Onboarding shows for new users (if enabled)
- [ ] Videos are set to "Unlisted" on YouTube

## 🐛 Troubleshooting

### Videos don't play
- Check that YouTube videos are set to **Unlisted** (not Private)
- Verify Video IDs are correct
- Check browser console for errors

### Help page is empty
- Ensure video IDs are added to `videos.js`
- Check that all videos have valid `id` properties

### Onboarding doesn't show
- Verify `HasSeenTutorial` is `false` for test user
- Check that `OnboardingWrapper` is properly integrated
- Look for console errors

## 📞 Support

For issues or questions about the video tutorial system, contact the development team.
