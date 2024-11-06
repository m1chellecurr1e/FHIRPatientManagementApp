<script lang="ts">
  import type { Patient } from "fhir/r4";
  import { fhirApi } from "./api";
  import { navigate } from "svelte-routing";
  import { onMount } from "svelte";

  export let id: string = ''

  const dateToday = new Date().toISOString().split("T")[0];

  let message: any | undefined = undefined
  let loading = false
  let patientResource: Patient | undefined = undefined

  let patientLoading = false
  let loadError: string | null = null

  let firstName: string | undefined
  let lastName: string | undefined
  let birtDate: string
  let phoneNumber: string = '';
  let gender: "other" | "male" | "female" | "unknown" | undefined = undefined

  let currentPatient: Patient | null = null;

  onMount(async () => {
    if (id) {
      try {
        const response = await fhirApi.get(`/Patient/${id}`);
        currentPatient = response.data;
        firstName = currentPatient.name?.[0]?.given?.[0] || '';
        lastName = currentPatient.name?.[0]?.family || '';
        birtDate = currentPatient.birthDate || '';
        gender = currentPatient.gender || '';
        phoneNumber = currentPatient.telecom?.[0]?.value || '';
      } catch (error) {
        console.error("Error loading patient:", error);
      }
    }
  });

  function formatPhoneNumber(input: string): string {
    // Remove all non-digit characters
    const cleaned = input.replace(/\D/g, '');
    
    // If the number starts with '1', remove it
    const digits = cleaned.startsWith('1') ? cleaned.slice(1) : cleaned;
    
    // If we have 10 digits, format it
    if (digits.length === 10) {
      return `+1 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    
    // If something's wrong, return the original input
    return input;
  }

  function handlePhoneInput(event: Event) {
    const input = event.target as HTMLInputElement;
    phoneNumber = formatPhoneNumber(input.value);
  }

  const confirmUpdate = (e: Event) => {
    e.preventDefault();
    if (id)  // Only show confirmation for updates, not for create
      showConfirmDialog = true;
    else
      handleSubmit();
  };

  const handleSubmit = async () => {
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);

      const updatedPatient: Patient = {
        resourceType: "Patient",
        ...(id ? currentPatient || {} : {}),
        name: [{
          given: [firstName],
          family: lastName
        }],
        gender: gender,
        birthDate: birtDate,
        telecom: [{
          system: "phone",
          value: formattedPhone,
          use: "home"
        }]
      }

      if (id) {
        console.log('Updating patient with:', updatedPatient);
        await fhirApi.put(`/Patient/${id}`, updatedPatient);
      } else {
        await fhirApi.post('/Patient', updatedPatient);
      }
      
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Error saving patient:', error);
      console.log('Failed request payload:', updatedPatient);
    }
  }

  const createPatient = async (resource: Patient): Promise<any> => {
    const response = await fhirApi.post('/Patient', resource)
    return response.data
  }

  const updatePatient = async (id: string, resource: Patient, oldResource: Patient): Promise<any> => {
    const response = await fhirApi.put(`/Patient/${id}`, {...oldResource, ...resource})
    return response.data
  }

  const loadPatient = async (id: string) => {
    const patientResponse = await fhirApi.get<Patient>(`/Patient/${id}`)
    const patientResource = patientResponse.data
    console.log({patientResource})
    const name = patientResource.name?.[0]
    firstName = name?.given?.[0]
    lastName = name?.family
    
    if (patientResource.birthDate) {
      birtDate = patientResource.birthDate
    }

    if (patientResource.gender) {
      gender = patientResource.gender
    }
    const phoneContactPoint = patientResource.telecom?.find(a=>a.system == 'phone')
    if (phoneContactPoint) {
      phoneNumber = phoneContactPoint.value
    }
    return patientResource
  }

  let showConfirmDialog = false;

</script>

<div class="p-12 sm:p-20 md:p-24 lg:p-32 xl:p-40">
  <h1 class="text-3xl font-semibold mb-10 text-center text-royal-blue">
    {#if id}
      Update Patient Information
    {:else}
      Create Patient
    {/if}
  </h1>
  {#if patientLoading}
    <p>Loading patient data...</p>
  {:else if loadError}
    <p class="text-red-500">{loadError}</p>
  {:else}
    <form class="space-y-3" on:submit={confirmUpdate}>
      <div>
        <label for="first_name" class="font-semibold block text-lg mb-1">First Name</label>
        <input bind:value={firstName} id="first_name" name="first_name" class="border p-2 w-full text-lg" required/>
      </div>
      <div>
        <label for="last_name" class="font-semibold block text-lg mb-1">Last Name</label>
        <input bind:value={lastName} class="border p-2 w-full text-lg" id="last_name" />
      </div>
      <div>
        <label for="gender" class="font-semibold block text-lg mb-1">Gender</label>
        <select bind:value={gender} id="gender" class="border p-2 w-full text-lg" required>
          <option value={undefined} disabled>Please select...</option>
          <option value="male">Male</option>
          <option value="female">Female</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label for="dob" class="font-semibold block text-lg mb-1">Date of Birth</label>
        <input bind:value={birtDate} class="border p-2 w-full text-lg" id="dob" type="date" max={dateToday} required/>
      </div>
      <div>
        <label for="phone" class="font-semibold block text-lg mb-1">Phone Number</label>
        <input 
          type="tel"
          id="phone"
          bind:value={phoneNumber}
          class="border p-2 w-full text-lg"
          placeholder="Enter phone number"
        />
      </div>
      <div>
        <button type="submit" class="p-2 bg-royal-blue text-white text-lg rounded">
          {#if loading}
            Loading...
          {:else if id}
            Update
          {:else}
            Create
          {/if}
        </button>
        <button type="button" class="p-2 bg-gray-300 text-black ml-2 text-lg rounded" on:click={() => navigate('/')}>
          Back to Patient List
        </button>
      </div>
    </form>
  {/if}

  {#if showConfirmDialog}
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white p-6 rounded-lg shadow-xl">
        <p class="mb-4 text-lg">Are you sure you want to update this patient?</p>
        <div class="flex justify-end">
          <button class="px-4 py-2 bg-gray-300 rounded mr-2" on:click={() => showConfirmDialog = false}>Cancel</button>
          <button class="px-4 py-2 bg-indigo text-white rounded" on:click={handleSubmit}>Confirm</button>
        </div>
      </div>
    </div>
  {/if}

  {#if message}
    <pre>
      Status:
      {JSON.stringify(message)}
    </pre>
  {/if}
</div>
