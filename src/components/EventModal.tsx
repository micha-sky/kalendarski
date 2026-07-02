import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/useApp';
import type { CalendarEvent } from '../types';
import { format } from 'date-fns';
import { X, Trash2, Calendar as CalendarIcon, Clock, MapPin } from 'lucide-react';

interface EventModalProps {
  isOpen: boolean;
  event?: CalendarEvent | null;
  initialDate?: Date | null;
  onSave: (event: Omit<CalendarEvent, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const EventModal: React.FC<EventModalProps> = ({
  isOpen,
  event,
  initialDate,
  onSave,
  onDelete,
  onClose,
}) => {
  const { calendars } = useApp();
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    start: new Date(),
    end: new Date(),
    allDay: false,
    calendarId: '',
    color: '#3b82f6',
    location: '',
    attendees: [] as string[],
  });

  // const [attendeeInput, setAttendeeInput] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (event) {
        // Editing existing event
        setFormData({
          title: event.title,
          description: event.description || '',
          start: event.start,
          end: event.end,
          allDay: event.allDay,
          calendarId: event.calendarId,
          color: event.color || '#3b82f6',
          location: event.location || '',
          attendees: event.attendees || [],
        });
      } else if (initialDate) {
        // Creating new event
        const startDate = new Date(initialDate);
        const endDate = new Date(initialDate);
        endDate.setHours(startDate.getHours() + 1);
        
        setFormData({
          title: '',
          description: '',
          start: startDate,
          end: endDate,
          allDay: false,
          calendarId: calendars[0]?.id || '',
          color: calendars[0]?.color || '#3b82f6',
          location: '',
          attendees: [],
        });
      }
    }
  }, [isOpen, event, initialDate, calendars]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.title.trim()) return;
    
    onSave({
      title: formData.title.trim(),
      description: formData.description.trim(),
      start: formData.start,
      end: formData.end,
      allDay: formData.allDay,
      calendarId: formData.calendarId,
      color: formData.color,
      location: formData.location.trim(),
      attendees: formData.attendees,
    });
  };

  // const handleAddAttendee = () => {
  //   if (attendeeInput.trim() && !formData.attendees.includes(attendeeInput.trim())) {
  //     setFormData({
  //       ...formData,
  //       attendees: [...formData.attendees, attendeeInput.trim()],
  //     });
  //     setAttendeeInput('');
  //   }
  // };

  // const handleRemoveAttendee = (attendee: string) => {
  //   setFormData({
  //     ...formData,
  //     attendees: formData.attendees.filter(a => a !== attendee),
  //   });
  // };

  const handleDateTimeChange = (field: 'start' | 'end', value: string) => {
    const newDate = new Date(value);
    setFormData({ ...formData, [field]: newDate });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block w-full max-w-md p-6 my-8 overflow-hidden text-left align-middle transition-all transform bg-white shadow-xl rounded-2xl">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-medium text-gray-900">
              {event ? 'Edit Event' : 'New Event'}
            </h3>
            <div className="flex items-center space-x-2">
              {event && onDelete && (
                <button
                  onClick={onDelete}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  aria-label="Delete event"
                >
                  <Trash2 size={16} />
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Title */}
            <div>
              <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Event title"
                required
              />
            </div>

            {/* Calendar Selection */}
            <div>
              <label htmlFor="calendar" className="block text-sm font-medium text-gray-700 mb-1">
                <CalendarIcon size={16} className="inline mr-1" />
                Calendar
              </label>
              <select
                id="calendar"
                value={formData.calendarId}
                onChange={(e) => {
                  const selectedCalendar = calendars.find(cal => cal.id === e.target.value);
                  setFormData({ 
                    ...formData, 
                    calendarId: e.target.value,
                    color: selectedCalendar?.color || formData.color
                  });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                {calendars.map((calendar) => (
                  <option key={calendar.id} value={calendar.id}>
                    {calendar.name}
                  </option>
                ))}
              </select>
            </div>

            {/* All Day Toggle */}
            <div className="flex items-center">
              <input
                type="checkbox"
                id="allDay"
                checked={formData.allDay}
                onChange={(e) => setFormData({ ...formData, allDay: e.target.checked })}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="allDay" className="ml-2 block text-sm text-gray-700">
                All day
              </label>
            </div>

            {/* Date and Time */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="start" className="block text-sm font-medium text-gray-700 mb-1">
                  <Clock size={16} className="inline mr-1" />
                  Start
                </label>
                <input
                  type={formData.allDay ? 'date' : 'datetime-local'}
                  id="start"
                  value={formData.allDay 
                    ? format(formData.start, 'yyyy-MM-dd')
                    : format(formData.start, "yyyy-MM-dd'T'HH:mm")
                  }
                  onChange={(e) => handleDateTimeChange('start', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label htmlFor="end" className="block text-sm font-medium text-gray-700 mb-1">
                  End
                </label>
                <input
                  type={formData.allDay ? 'date' : 'datetime-local'}
                  id="end"
                  value={formData.allDay 
                    ? format(formData.end, 'yyyy-MM-dd')
                    : format(formData.end, "yyyy-MM-dd'T'HH:mm")
                  }
                  onChange={(e) => handleDateTimeChange('end', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                <MapPin size={16} className="inline mr-1" />
                Location
              </label>
              <input
                type="text"
                id="location"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Event location"
              />
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                Description
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Event description"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                {event ? 'Update' : 'Create'} Event
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default EventModal;
