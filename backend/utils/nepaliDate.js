// Nepali (Bikram Sambat) calendar utility
// Reference data for BS calendar conversion

const BS_MONTHS = [
  'Baisakh', 'Jestha', 'Ashad', 'Shrawan', 'Bhadra', 'Ashwin',
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

// Days in each month for BS years (2000-2090)
const BS_YEAR_DATA = {
  2080: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2081: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2082: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2083: [31, 31, 32, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2084: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
  2085: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2079: [31, 32, 31, 32, 31, 30, 30, 29, 30, 29, 30, 30],
  2078: [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30],
  2077: [31, 32, 31, 32, 31, 30, 30, 30, 29, 29, 30, 30],
  2076: [31, 32, 31, 32, 31, 30, 30, 30, 29, 30, 29, 31],
};

// AD start reference: BS 2000/01/01 = AD 1943/04/14
const BS_START_AD = new Date(1943, 3, 14); // April 14, 1943
const BS_START_YEAR = 2000;

// Convert AD date to BS
export const adToBS = (adDate) => {
  const date = new Date(adDate);
  
  // Difference in days from BS epoch
  const refDate = new Date(1943, 3, 14);
  const diffTime = date.getTime() - refDate.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { year: 2000, month: 1, day: 1, monthName: 'Baisakh', fullDate: '2000 Baisakh 01' };
  }

  // Simple approximation: BS year ≈ AD year + 56/57
  const adYear = date.getFullYear();
  const adMonth = date.getMonth() + 1;
  const adDay = date.getDate();

  let bsYear = adYear + 56;
  let bsMonth, bsDay;

  // Nepali new year is around April 13-15
  if (adMonth < 4 || (adMonth === 4 && adDay < 14)) {
    bsYear = adYear + 56;
  } else {
    bsYear = adYear + 57;
  }

  // Approximate month conversion
  // AD April 14 ≈ BS Baisakh 1
  const adDayOfYear = getDayOfYear(date);
  const nepaliNewYearDay = getDayOfYear(new Date(adYear, 3, 14)); // April 14

  let bsDayFromNewYear;
  if (adDayOfYear >= nepaliNewYearDay) {
    bsDayFromNewYear = adDayOfYear - nepaliNewYearDay;
  } else {
    bsDayFromNewYear = getDayOfYear(new Date(adYear - 1, 11, 31)) - nepaliNewYearDay + getDayOfYear(new Date(adYear - 1, 3, 14)) + adDayOfYear;
    bsYear = adYear + 56;
  }

  const monthDays = BS_YEAR_DATA[bsYear] || [31, 31, 32, 31, 31, 31, 30, 29, 30, 29, 30, 30];
  
  bsMonth = 0;
  let remaining = bsDayFromNewYear;
  
  for (let i = 0; i < 12; i++) {
    if (remaining < monthDays[i]) {
      bsMonth = i + 1;
      bsDay = remaining + 1;
      break;
    }
    remaining -= monthDays[i];
  }

  if (!bsMonth) {
    bsMonth = 12;
    bsDay = monthDays[11];
  }

  const monthName = BS_MONTHS[bsMonth - 1];
  const fullDate = `${bsYear} ${monthName} ${String(bsDay).padStart(2, '0')}`;

  return { year: bsYear, month: bsMonth, day: bsDay, monthName, fullDate };
};

const getDayOfYear = (date) => {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date - start;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
};

export const getCurrentNepaliDate = () => {
  return adToBS(new Date());
};

export const BS_MONTH_NAMES = BS_MONTHS;
