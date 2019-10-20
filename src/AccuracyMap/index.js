import AccuracyEntry from './AccuracyEntry';
import DurationList from '../DurationList';
import { validateAccuracyObject } from '../utilities';

class InvalidAccuracyMapInputError extends Error {}

const validateDurationsIsDurationList = durations => {
  if (!(durations instanceof DurationList)) {
    throw new InvalidAccuracyMapInputError(
      'Expected durations to be a DurationList, but it was not.'
    );
  }
};

const validateDurations = durations => {
  validateDurationsIsDurationList(durations);

  return durations;
};

const validateAccuracyListIsArray = accuracyList => {
  if (!Array.isArray(accuracyList)) {
    throw new InvalidAccuracyMapInputError(
      'Expected accuracy specification to be an array, but it was not.'
    );
  }
};

const validateAccuracyListObjects = accuracyList => {
  accuracyList.forEach(validateAccuracyObject);
};

const validateAccuracyListIsInAscendingOrder = accuracyList => {
  for (let i = 0; i < accuracyList.length - 1; i++) {
    const currentAccuracy = accuracyList[i];
    const nextAccuracy = accuracyList[i + 1];

    if (currentAccuracy.difference.value > nextAccuracy.difference.value) {
      throw new InvalidAccuracyMapInputError(
        'Expected accuracy specification to be in ascending order by difference, but it was not.'
      );
    }
  }
};

const validateAccuracyList = accuracyList => {
  validateAccuracyListIsArray(accuracyList);
  validateAccuracyListObjects(accuracyList);
  validateAccuracyListIsInAscendingOrder(accuracyList);

  return accuracyList;
};

const validateAccuracyListStartsWithSmallestDuration = (durationList, accuracyList) => {
  const smallestDuration = durationList.get()[0];
  if (accuracyList[0].difference !== smallestDuration) {
    throw new Error(
      'Accuracy specifications must begin with the shortest duration passed to the TimeProviders.'
    );
  }
};

// At the point that this is called, durationList and accuracyList are both in ascending order.
const makeAccuracyListIntoObject = (durationList, accuracyList) => {
  const durations = durationList.get();
  let currentAccuracyIndex = 0;

  const accuracyMap = durations.reduce((accumulator, duration) => {
    const currentAccuracy = accuracyList[currentAccuracyIndex];

    if (currentAccuracy === undefined) {
      console.log(currentAccuracy, accuracyList, currentAccuracyIndex);
    }

    if (currentAccuracy.difference === duration) {
      accumulator[duration.key] = new AccuracyEntry(currentAccuracy);
    } else {
      accumulator[duration.key] = new AccuracyEntry(currentAccuracy);
      if (currentAccuracyIndex < accuracyList.length - 1) {
        currentAccuracyIndex++;
      }
    }

    return accumulator;
  }, {});

  return accuracyMap;
};

class InvalidAccuracyMapRequestError extends Error {}

const isDurationWithinRange = (duration, lowerBound, upperBound) =>
  duration.value >= lowerBound.value && duration.value <= upperBound.value;

const greaterDuration = (first, second) => (first.value >= second.value ? first : second);
const lesserDuration = (first, second) => (first.value <= second.value ? first : second);

class AccuracyMap {
  constructor(durations, accuracyList) {
    const validatedDurations = validateDurations(durations);
    const validatedAccuracyList = validateAccuracyList(accuracyList);
    validateAccuracyListStartsWithSmallestDuration(validatedDurations, validatedAccuracyList);
    this.value = makeAccuracyListIntoObject(validatedDurations, validatedAccuracyList);
  }

  getOptimalEntry(duration) {
    const entry = this.value[duration.key];

    if (!entry) {
      throw new InvalidAccuracyMapRequestError(
        `Unable to find an appropriate entry for duration with key "${duration.key}".`
      );
    }

    const targetAccuracyEntry = this.value[duration.key];

    return targetAccuracyEntry;
  }

  getOptimalDuration(duration, localAccuracyMap) {
    const targetEntry = this.getOptimalEntry(duration);

    if (!localAccuracyMap) {
      return targetEntry.preferredAccuracy;
    }

    const localEntry = localAccuracyMap.getOptimalEntry(duration);

    const isLocalPreferredAccuracyWithinRange = isDurationWithinRange(
      localEntry.preferredAccuracy,
      targetEntry.maximumAccuracy,
      targetEntry.minimumAccuracy
    );

    if (isLocalPreferredAccuracyWithinRange) {
      return localEntry.preferredAccuracy;
    }

    const isLocalPreferredAccuracyGreaterThanGlobal =
      localEntry.preferredAccuracy.value > targetEntry.maximumAccuracy.value;

    if (isLocalPreferredAccuracyGreaterThanGlobal) {
      return greaterDuration(localEntry.maximumAccuracy, targetEntry.minimumAccuracy);
    }

    const isLocalPreferredAccuracyLessThanGlobal =
      localEntry.preferredAccuracy.value < targetEntry.minimumAccuracy.value;

    if (isLocalPreferredAccuracyLessThanGlobal) {
      return lesserDuration(localEntry.minimumAccuracy, targetEntry.maximumAccuracy);
    }
  }

  getOptimalContext(duration, localAccuracyMap) {
    return this.getOptimalDuration(duration, localAccuracyMap).context;
  }
}

export default AccuracyMap;
